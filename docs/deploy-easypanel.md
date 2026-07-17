# Deploy no EasyPanel

## Docker

- Dockerfile: raiz do projeto frontend (`Dockerfile`)
- Build context: `/`
- Porta interna: `80`
- Domínio de produção: `https://app.defumarevents.com.br`

## Variáveis de build

As variáveis `VITE_*` são aplicadas em build-time pelo Vite. Após alterar qualquer uma delas no EasyPanel, faça um novo build/deploy da imagem.

Valores de produção:

```env
VITE_API_URL=https://api.defumarevents.com.br
VITE_SOCKET_URL=https://api.defumarevents.com.br
VITE_APP_URL=https://app.defumarevents.com.br
```

No EasyPanel, configure esses valores como build args/envs disponíveis durante o build Docker. O Dockerfile não contém secrets.

## Build local

```bash
docker build \
  --build-arg VITE_API_URL=https://api.defumarevents.com.br \
  --build-arg VITE_SOCKET_URL=https://api.defumarevents.com.br \
  --build-arg VITE_APP_URL=https://app.defumarevents.com.br \
  -t defumar-frontend .
```

## Execução local

```bash
docker run --rm -p 8080:80 defumar-frontend
```

Healthcheck interno:

```text
/health
```
