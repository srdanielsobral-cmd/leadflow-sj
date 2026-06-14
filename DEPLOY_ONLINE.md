# Publicar o LeadFlow online gratis

O caminho gratuito mais simples para este projeto e:

- Render Free para hospedar o servidor Node.js.
- Aiven Free para hospedar o banco MySQL.

O Railway tambem continua compatível, mas hoje o plano gratuito funciona como teste/creditos e pode virar cobranca depois.

## 1. Preparar o banco MySQL gratis na Aiven

1. Acesse https://aiven.io e crie uma conta.
2. Crie um servico "Aiven for MySQL" no plano Free.
3. Depois que o banco ficar ativo, copie os dados de conexao:
   - Host
   - Port
   - User
   - Password
   - Database
4. Abra o console/query editor da Aiven e execute o arquivo `database.sql`.

Usuario inicial:

```text
usuario: admin
senha: admin123
```

Troque essa senha assim que acessar o sistema.

## 2. Publicar o servidor gratis no Render

1. Coloque esta pasta em um repositorio GitHub.
2. Acesse https://render.com e crie uma conta.
3. Clique em "New" > "Web Service".
4. Conecte o repositorio do GitHub.
5. O Render deve detectar o arquivo `render.yaml`. Se pedir configuracao manual, use:

```text
Runtime: Node
Build Command: npm install
Start Command: npm start
Plan: Free
Health Check Path: /health
```

## 3. Variaveis de ambiente no Render

Cadastre no servico do Render:

```text
HOST=0.0.0.0
DB_HOST=host-da-aiven
DB_PORT=porta-da-aiven
DB_USER=usuario-da-aiven
DB_PASSWORD=senha-da-aiven
DB_NAME=nome-do-banco-da-aiven
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=false
RESET_ADMIN=0
```

Nao precisa cadastrar `PORT`; o Render define essa variavel automaticamente.

## 4. Testar online

Depois do deploy terminar, abra:

```text
https://sua-url-do-render.onrender.com/login
```

Teste a saude do servidor:

```text
https://sua-url-do-render.onrender.com/health
```

Se aparecer `{"ok":true,"app":"S&J Sistema"}`, o servidor esta online.

## 5. Recuperar acesso admin

Se perder o acesso de administrador, cadastre temporariamente no Render:

```text
RESET_ADMIN=1
ADMIN_USUARIO=admin
ADMIN_SENHA=admin123
```

Faca um novo deploy/restart. Depois entre com:

```text
usuario: admin
senha: admin123
```

Depois de entrar, troque a senha em Configuracoes e volte `RESET_ADMIN=0`.

## Observacoes importantes

- O plano gratis do Render pode "dormir" quando fica sem acesso. O primeiro acesso depois de um tempo pode demorar alguns segundos.
- O plano gratis da Aiven tem limite de armazenamento, mas e suficiente para comecar.
- Nao publique o arquivo `.env` no GitHub. Ele ja esta no `.gitignore`.
