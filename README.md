# ConversorRelatoriosHidrotech


# Conversor de Relatórios PDF para Excel

Este projeto é uma API em Node.js, que automatiza a extração de dados de relatórios de medição em PDF (padrão Hidrotech) e os converte em planilhas Excel (`.xlsx`)

* Geração do Excel 100% na memória RAM (Buffer/Base64) sem deixar arquivos residuais no servidor.

---

## Pré-requisitos (O que instalar antes de rodar)

Para que o sistema funcione corretamente na sua máquina, é **obrigatório** ter dois softwares instalados.

### 1. Node.js (Servidor e Lógica)
O Node.js é o motor que vai rodar o nosso código JavaScript no back-end.
* **Baixe aqui:** [Site Oficial do Node.js](https://nodejs.org/pt-br/download)
* Escolha a versão **LTS (Recomendada para a maioria dos usuários)**.
* Instale no padrão "Next, Next, Finish".

### 2. Java - JRE ou JDK (Motor de Extração do PDF)
A nossa API utiliza a biblioteca `Tabula`, que é escrita em Java. O Windows precisa saber ler comandos Java.
* **Baixe aqui:** [Site Oficial do Java (Oracle)](https://www.java.com/pt-BR/download/)
* Instale no padrão "Next, Next, Finish".

> **Como testar se instalou certo?**
> Abra o *Prompt de Comando* (CMD) ou *PowerShell* e digite:
> `node -v` (Deve aparecer a versão, ex: v20.x.x)
> `java -version` (Deve aparecer a versão do Java instalada)

---

## 🚀 Passo a Passo para Instalação

**1.** Baixe este repositório para a sua máquina (ou faça o `git clone`).
**2.** Certifique-se de que o arquivo principal do Tabula (`tabula-1.0.5-jar-with-dependencies.jar`) está dentro da pasta raiz do projeto.
**3.** Abra o terminal (CMD/PowerShell/Terminal do VS Code) **dentro da pasta do projeto**.
**4.** Instale as dependências do projeto executando o comando abaixo:
```bash
npm install
```
*(Isso vai ler o arquivo `package.json` e baixar as bibliotecas: Express, Multer, Cors e ExcelJS, criando a pasta `node_modules`).*

---

## 💻 Como Rodar o Sistema

Com tudo instalado, abra o terminal na pasta do projeto e inicie o servidor:

```bash
node app.js
```

Se tudo der certo, você verá a mensagem:
`API rodando na porta 3000`

**Para usar o sistema:**
1. Abra o seu navegador (Chrome, Edge, Safari, etc.).
2. Digite na barra de endereços: **http://localhost:3000**
3. A interface web será carregada.
4. Escolha o PDF do relatório, clique em "Converter e Baixar" e o `.xlsx` será baixado perfeitamente na sua máquina!
