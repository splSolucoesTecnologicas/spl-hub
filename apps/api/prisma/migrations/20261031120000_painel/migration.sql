-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN "latitude" DOUBLE PRECISION,
ADD COLUMN "longitude" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "tarefas" ADD COLUMN "projetoId" UUID;

-- CreateTable
CREATE TABLE "clientes" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "uf" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "responsavelId" UUID,
    "ultimoContato" TIMESTAMP(3),
    "observacoes" TEXT NOT NULL DEFAULT '',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decisoes" (
    "id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "detalhe" TEXT NOT NULL DEFAULT '',
    "quando" TIMESTAMP(3) NOT NULL,
    "autorId" UUID NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "decisoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "objetivos" (
    "id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "progresso" INTEGER NOT NULL,
    "periodo" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "objetivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projetos" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "descricao" TEXT NOT NULL DEFAULT '',
    "cor" TEXT NOT NULL,
    "repositorio" TEXT,
    "quadroUrl" TEXT,
    "adminUrl" TEXT,
    "progresso" INTEGER NOT NULL DEFAULT 0,
    "progressoRotulo" TEXT NOT NULL DEFAULT '',
    "responsaveis" JSONB NOT NULL,
    "clienteIds" TEXT[],
    "marcos" JSONB NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "projetos_pkey" PRIMARY KEY ("id")
);
