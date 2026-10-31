-- AlterTable
ALTER TABLE "projetos" ADD COLUMN "githubProjectNumero" INTEGER,
ADD COLUMN "githubColunaMap" JSONB;

-- AlterTable
ALTER TABLE "tarefas" ADD COLUMN "githubIssueNumero" INTEGER,
ADD COLUMN "githubItemNodeId" TEXT;
