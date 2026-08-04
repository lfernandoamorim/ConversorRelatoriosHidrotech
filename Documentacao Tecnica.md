# Documentacao Tecnica - API Extrator PDF/Excel

Este documento detalha a arquitetura interna, o fluxo de dados e a responsabilidade de cada variavel dentro do script `app.js`. O objetivo e guiar mantenedores do codigo na compreensao do motor de extracao e na logica de tratamento de texto (RegEx) aplicada aos relatorios.

## 1. Bibliotecas e Dependencias Principais

*   **express:** Framework minimalista para criacao do servidor web e roteamento.
*   **multer:** Middleware para interceptacao de uploads. Configurado com `os.tmpdir()` para salvar o PDF temporariamente na pasta nativa do sistema, prevenindo acumulo de lixo no disco do servidor.
*   **exceljs:** Motor de criacao e manipulacao de planilhas. Opera em memoria (RAM) e permite aplicacao detalhada de UI/UX (cores, bordas, merge de celulas, injecao de imagens).
*   **child_process (exec):** Modulo nativo do Node.js utilizado para instanciar o leitor Java (Tabula) via linha de comando (CLI).

## 2. Fluxo da Requisicao (Endpoint)

**Rota:** `POST /api/extrair-tabela`
**Payload:** Arquivo binario (`multipart/form-data`) sob a chave `arquivo`.

### 2.1. Execucao do Tabula (Extrator)
A variavel `comando` define a instrucao passada ao sistema operacional:
`java -Dfile.encoding=utf-8 -jar "tabula...jar" -p all -t -f TSV "arquivo.pdf"`
*   `-Dfile.encoding=utf-8`: Garante que o Java envie acentuacoes e caracteres especiais nativamente para o Node.js.
*   `-p all`: Instrui a leitura de todas as paginas do PDF.
*   `-t`: Habilita o modo "Stream" (analise por espacos em branco), essencial para PDFs onde as linhas da tabela estao ocultas ou ausentes.
*   `-f TSV`: Forca a saida em *Tab-Separated Values*, protegendo as virgulas dos valores monetarios.

### 2.2. Variaveis de UI e Estilizacao (ExcelJS)
Antes do processamento dos dados, o layout basico e definido:
*   `azulClaro` (`FFDEE6F0`): Define a cor de fundo (Background) do cabecalho e de colunas de destaque (Apto e Valor Individual).
*   `azulBorda` (`FFB4C6E7`): Define a cor das linhas de grade internas da tabela.
*   `worksheet.columns`: Array de objetos que define as chaves (`key`) de mapeamento e as larguras (`width`) fixas das 6 colunas do relatorio.

## 3. Logica de Extracao e Parsing (Variaveis de Memoria)

O bloco central analisa a string bruta (`stdout`) devolvida pelo Java.

### 3.1. Parsing do Cabecalho (Grid Superior)
O script utiliza variaveis de estado (let) alimentadas por Expressoes Regulares (Regex) para identificar os titulos:
*   `matchRGI`: Busca a string "RGI:" seguida de digitos numericos. Se encontrado, alimenta a variavel `rgi`.
*   `textoSemRGI`: Aplica uma "guilhotina", removendo o RGI do texto em memoria para evitar que a sigla seja incorporada ao nome do condominio.
*   `matchCond`: Vareja o `textoSemRGI` em busca de palavras em caixa alta associadas a substantivos chaves (MILAS, CONDOMINIO, RESIDENCIAL). Alimenta a variavel `tituloCondominio`.
*   `matchSubtitulo`: Busca a string "Leitura dos medidores". Possui uma condicional corretiva: caso o leitor engula o "L" inicial (retornando "eitura"), o Javascript concatena a string corretamente, alimentando a variavel `subtitulo`.

### 3.2. Injecao Dinamica de Logotipo
*   `logoUrl`: Constante que aponta para o bucket do Supabase.
*   O bloco executa um `fetch` assincrono, convertendo a imagem web em um `ArrayBuffer` e posteriormente em um `Buffer` do Node, vinculando-o ao `workbook` e posicionando-o (atraves do eixo X, Y) nas celulas A1/A2 do grid da planilha.

### 3.3. Extracao Dinamica de Datas (Cabecalho da Tabela)
O sistema busca formatar dinamicamente os nomes das colunas de leitura.
*   `matchAnterior` / `matchAtual`: Avalia o texto em um raio de 300 caracteres ao redor das palavras "Anterior" e "Atual" em busca de um padrao de data (`dd/mm/yyyy`).
*   `todasAsDatas` (Fallback): Caso a extracao especifica falhe (devido a layout corrompido do PDF), coleta globalmente as duas primeiras datas encontradas no documento.
*   O resultado formata a variavel `linhaCabecalho`, inserindo quebras de linha (`\n`) para que a data fique sob o texto na celula.

## 4. Estrutura de Repeticao (Corpo da Tabela e Rodape)

O arquivo e desmembrado em um array pela variavel `linhas = stdout.split('\n')`.

### 4.1. O "Interruptor" do Rodape (`isRodape`)
Para evitar que listas numeradas do rodape sejam lidas como apartamentos, foi estabelecida a variavel booleana `isRodape`, inicializada como `false`.
*   Ao detectar strings-chave (ex: "consumo total individual"), `isRodape = true`.
*   Quando ativado, todo o texto subsequente ignora o bloco de processamento da tabela e sofre *push* diretamente no array de memoria `linhasRodape`.

### 4.2. Processamento de Linhas de Apartamento
*   `primeiroBloco`: Captura a primeira informacao da linha antes de espacos ou tabulacoes.
*   Filtro Restritivo: `^\d+$` testa se o bloco e estritamente numerico e se possui ate 4 caracteres.
*   **Corretor de Espacamento (Failsafe):** Se o Java aglutinar celulas (`colunas.length < 6`), o script engatilha um corretor manual que faz um `join` das strings, protege a moeda via regex (`/R\$\s+/g`), e efetua um re-split forcado pelos espacos em branco (`\s+`), reconstruindo as 6 colunas obrigatorias antes de inseri-las na planilha.

### 4.3. Renderizacao do Rodape
O array `linhasRodape` e iterado no final da execucao.
*   **Linhas de Totais Financeiros:** Se a linha contem a palavra "consumo" e nao contem "unidades", a Regex `/^(.*?consumo.*?)\s+(\d+.*)$/i` e invocada para separar o titulo descritivo (string) da matriz de valores. As celulas sao adicionadas, os layouts aplicados individualmente (cores em A, D, E e F) e as celulas mescladas.
*   **Linhas de Texto (Observacoes):** Sofrem insercao integral (linha corrida) e mesclagem total (Merge A:F), com altura de celula responsiva e alinhamento "wrapText". Excecao de formatacao para a string "vencimento", que recebe negrito e centralizacao automatica.

## 5. Resposta HTTP e Encerramento
Apos o mapeamento em memoria, o objeto de resposta (`res`) do Express tem os Headers alterados:
*   `Content-Type`: Setado para MIME type de planilha `.xlsx`.
*   `Content-Disposition`: Setado como `attachment` contendo o `filename`.
*   `workbook.xlsx.write(res)`: Transmite o Buffer gerado instantaneamente pela rede TCP, esvaziando a memoria do back-end ao encerramento (`res.end()`).
