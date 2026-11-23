# Sprint 4 — como conseguir as chaves de teste

Passo a passo para ligar o pagamento real (Stripe, T1/T2/T5) e o frete real
(Melhor Envio, T3). Tudo em **modo de teste**: nenhum dinheiro de verdade é
cobrado e nenhuma etiqueta de verdade é gerada.

> **Nunca cole uma chave no chat, no Git ou num print.** As chaves só vão no
> arquivo `.env`, que fica no seu computador e não sobe para o GitHub.

Ao final você terá três linhas novas no `.env`:

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
MELHOR_ENVIO_TOKEN=eyJ...
```

---

## Parte 1 — Stripe (pagamento)

### 1.1 Criar a conta

1. Abra <https://dashboard.stripe.com/register>.
2. Preencha e-mail, nome e senha. Em **País**, escolha **Brasil**. Sem isso o
   boleto não funciona.
3. Confirme o e-mail que o Stripe enviar.
4. Se o Stripe pedir para "ativar a conta" (CNPJ, conta bancária etc.),
   **pule**. O modo de teste funciona sem ativação.

### 1.2 Pegar a chave secreta (`STRIPE_SECRET_KEY`)

1. O modo de teste agora se chama **Área restrita** (Sandbox). Clique no nome
   da conta, no canto superior esquerdo, e entre na área restrita da loja. O
   topo mostra a faixa "Você está testando em uma área restrita".
2. Vá em **Desenvolvedores → Chaves de API**, aba **Chaves secretas**.
3. Na chave da lista, clique em **⋯ → Revelar chave** (ou em **Criar chave
   secreta**) e copie. Ela começa com `sk_test_`.
   - Se começar com `sk_live_`, você está fora da área restrita. Volte ao
     passo 1.

### 1.3 Ligar o boleto

1. Dentro da área restrita, clique na engrenagem ⚙️ → **Formas de pagamento**.
2. Procure **Boleto** e deixe **ativado**. Confira também **Cards / Cartões**
   e **Link** (a carteira digital do Stripe) ativados.

### 1.4 Instalar o Stripe CLI e pegar o `STRIPE_WEBHOOK_SECRET`

O CLI é o programa que entrega os avisos do Stripe ("o cliente pagou") para
a loja rodando no seu Mac.

1. Abra o app **Terminal** e rode:

   ```bash
   brew install stripe/stripe-cli/stripe
   ```

2. Faça login (abre o navegador). Se perguntar o ambiente, escolha a
   **Área restrita** da loja e clique em **Allow access / Permitir**:

   ```bash
   stripe login
   ```

3. Rode o comando abaixo e **deixe essa janela do Terminal aberta** enquanto
   testa a loja:

   ```bash
   stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired --forward-to localhost:3000/api/webhooks/stripe
   ```

4. Ele mostra uma linha assim:
   `Ready! Your webhook signing secret is whsec_xxxxx`.
   Copie o `whsec_...`. Esse é o `STRIPE_WEBHOOK_SECRET`.
   - O `whsec_` continua o mesmo nas próximas vezes que você rodar o
     `stripe listen` no mesmo computador.
   - O Stripe CLI 1.53+ exige o `--events`: são os 4 avisos que a loja usa.

---

## Parte 2 — Melhor Envio (frete)

O sandbox do Melhor Envio é um site **separado** do Melhor Envio normal, com
cadastro próprio.

1. Abra <https://sandbox.melhorenvio.com.br> e crie uma conta (pode usar o
   mesmo e-mail; os dados podem ser de teste).
2. Já logado, no menu da esquerda: **Integrações** → **Permissões de acesso**.
3. Clique em **Gerar novo token**.
4. Marque "Li e concordo com as condições" e clique em **Avançar**.
5. Em **Nome**, escreva `vestra-room`. Clique em **Selecionar todos** e depois
   em **Gerar token**.
6. Clique em **Copiar token**. Ele é bem comprido (começa com `eyJ`).
   **Só aparece essa vez**: se perder, gere outro.

---

## Parte 3 — Colocar as chaves no `.env`

1. No Terminal, entre na pasta do projeto e abra o `.env` no Editor de Texto:

   ```bash
   cd ~/Desktop/"Vestra Room"
   ```

   ```bash
   open -e .env
   ```

2. Vá até o final do arquivo e acrescente as três linhas, **sem aspas** e sem
   espaço antes ou depois do `=`:

   ```
   STRIPE_SECRET_KEY=sk_test_cole_aqui
   STRIPE_WEBHOOK_SECRET=whsec_cole_aqui
   MELHOR_ENVIO_TOKEN=cole_aqui
   ```

3. Salve (⌘S) e feche.
4. Avise o Claude no chat (só "pronto", **sem** colar as chaves). Ele reinicia
   a loja e testa.

### Conferindo sem mostrar a chave

Se quiser conferir que as linhas estão lá, este comando mostra só o nome de
cada uma, nunca o valor:

```bash
grep -oE "^(STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|MELHOR_ENVIO_TOKEN)=" .env
```

---

## Depois: Vercel (para a apresentação)

Para a loja publicada também usar o Stripe e o Melhor Envio, as mesmas
variáveis precisam ir para a Vercel (Settings → Environment Variables), e o
webhook da Vercel é cadastrado no painel do Stripe (Developers → Webhooks),
com outro `whsec_`. Isso fica para depois que tudo funcionar no seu Mac; o
Claude explica na hora.
