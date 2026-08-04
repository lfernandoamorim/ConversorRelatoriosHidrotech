# Hidrotech - Conversor de Relatórios PDF para Excel

API em Node.js que recebe um relatório de medição de água (PDF, padrão Hidrotech),
extrai as tabelas usando o **Tabula** (Java) e devolve uma planilha **Excel (.xlsx)**
já formatada (cabeçalho, logo, rodapé com totais e observações).

- Extração das tabelas: `tabula-1.0.5-jar-with-dependencies.jar`
- Geração da planilha: `ExcelJS`
- Tudo processado em memória (Buffer), sem deixar arquivo residual no servidor
- Interface web simples (`public/index.html`) para upload e download manual

## Estrutura do projeto

```
.
├── app.js                                     # API (Express) + logica de extracao/formatacao
├── package.json
├── public/
│   └── index.html                             # tela de upload (servida em "/")
├── tabula-1.0.5-jar-with-dependencies.jar      # motor de extracao das tabelas do PDF
├── Dockerfile
├── docker-compose.yml                         # stack para Portainer (Swarm + Traefik)
└── .dockerignore
```

## Rodando localmente (sem Docker)

Pré-requisitos: **Node.js LTS** e **Java (JRE/JDK)** instalados na máquina
(`node -v` e `java -version` devem responder).

```bash
npm install
node app.js
```

Acesse **http://localhost:3000** para usar a interface, ou chame a API diretamente:

```
POST http://localhost:3000/api/extrair-tabela
Content-Type: multipart/form-data
campo: arquivo (PDF)
```

## Deploy em VPS Linux (Docker + Portainer + Traefik)

Pré-requisitos na VPS: Docker instalado, Swarm inicializado (`docker swarm init`),
Traefik já rodando como proxy reverso e a rede externa `network_public` criada
(mesmo padrão usado nas outras stacks).

### 1. Enviar o projeto para a VPS

Envie esta pasta para a VPS (via `git clone` do seu repositório, `scp`, etc.), incluindo
o arquivo `tabula-1.0.5-jar-with-dependencies.jar`.

### 2. Buildar a imagem Docker

Dentro da pasta do projeto, na VPS:

```bash
docker build -t hidrotech-conversor:latest .
```

> A imagem inclui Node.js **e** um JRE (Java), necessário para o Tabula rodar dentro
> do container — não é preciso instalar Java na VPS manualmente.

Como a imagem não vem de um registry, ela fica disponível apenas no node onde foi
buildada. Por isso o `docker-compose.yml` já vem com a constraint `node.role == manager`.
Se seu Swarm tiver **mais de um node** e você quiser liberdade de agendamento, publique a
imagem num registry privado (Docker Hub, GHCR, Harbor, etc.) e troque a linha `image:`
do compose pelo caminho do registry.

### 3. Subir a stack no Portainer

1. No Portainer, vá em **Stacks → Add stack**.
2. Dê um nome (ex.: `hidrotech-conversor`).
3. Cole o conteúdo de `docker-compose.yml`.
4. Ajuste a linha do domínio antes de subir:
   ```yaml
   - traefik.http.routers.hidrotech-conversor.rule=Host(`conversor.seudominio.com.br`)
   ```
5. Clique em **Deploy the stack**.

O Traefik vai expor a aplicação em `https://conversor.seudominio.com.br`, com SSL
automático via Let's Encrypt (mesmo `certresolver` usado nas suas outras stacks).

### 4. Atualizando depois de uma mudança no código

```bash
git pull                                   # ou reenvie os arquivos atualizados
docker build -t hidrotech-conversor:latest .
```

Depois, no Portainer, use **Update the stack** (ou `docker service update --force
<nome_da_stack>_hidrotech-conversor`) para forçar o serviço a subir com a imagem nova.

## Variáveis de ambiente

| Variável   | Padrão       | Descrição                          |
|------------|--------------|-------------------------------------|
| `PORT`     | `3000`       | Porta interna em que a API escuta   |
| `NODE_ENV` | `production` | Ambiente de execução                |

## Observações

- O nome do arquivo do jar precisa ser exatamente
  `tabula-1.0.5-jar-with-dependencies.jar` e ficar na raiz do projeto (é o que o
  `app.js` espera).
- A logo da Hidrotech usada no cabeçalho da planilha é baixada em tempo de execução
  de uma URL pública no Supabase Storage — a VPS precisa ter saída de internet
  liberada para esse domínio.
