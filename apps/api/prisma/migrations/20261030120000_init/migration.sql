-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "totpSegredo" TEXT,
    "totpAtivo" BOOLEAN NOT NULL DEFAULT false,
    "vinculo" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "cidade" TEXT,
    "uf" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "admin" BOOLEAN NOT NULL DEFAULT false,
    "permissoes" JSONB NOT NULL,
    "frentes" TEXT[],
    "exemplo" BOOLEAN NOT NULL DEFAULT false,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoAte" TIMESTAMP(3),
    "ultimoAcesso" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

CREATE TABLE "sessoes" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sessoes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sessoes_tokenHash_key" ON "sessoes"("tokenHash");
ALTER TABLE "sessoes" ADD CONSTRAINT "sessoes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "desafios_totp" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "desafios_totp_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "solicitacoes_acesso" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "modulo" TEXT NOT NULL,
    "nivel" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "exemplo" BOOLEAN NOT NULL DEFAULT false,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "solicitacoes_acesso_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "auditoria" (
    "id" UUID NOT NULL,
    "atorId" UUID NOT NULL,
    "acao" TEXT NOT NULL,
    "alvo" TEXT NOT NULL,
    "detalhe" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tarefas" (
    "id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "coluna" TEXT NOT NULL,
    "produto" TEXT NOT NULL,
    "responsavelId" UUID,
    "observadorIds" TEXT[],
    "referencia" TEXT,
    "pullRequest" TEXT,
    "prazo" TIMESTAMP(3),
    "exemplo" BOOLEAN NOT NULL DEFAULT false,
    "sincronizadaEm" TIMESTAMP(3),
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadaEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tarefas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "noticias" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "resumo" TEXT NOT NULL,
    "corpo" TEXT NOT NULL,
    "publicada" BOOLEAN NOT NULL DEFAULT false,
    "publicadaEm" TIMESTAMP(3),
    "autorNome" TEXT NOT NULL,
    "exemplo" BOOLEAN NOT NULL DEFAULT false,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "noticias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "noticias_slug_key" ON "noticias"("slug");
