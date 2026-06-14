CREATE DATABASE IF NOT EXISTS sj_sistema
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE sj_sistema;

CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    usuario VARCHAR(80) NOT NULL UNIQUE,
    senha VARCHAR(120) NOT NULL,
    foto_perfil LONGTEXT NULL,
    tipo VARCHAR(20) NOT NULL DEFAULT 'consultor',
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    local_desejado VARCHAR(150) NULL,
    telefone VARCHAR(40) NULL,
    origem VARCHAR(80) NULL,
    status_cliente VARCHAR(30) NULL,
    interesse_imovel VARCHAR(30) NULL,
    possui_fgts VARCHAR(10) NULL,
    score_aproximado VARCHAR(20) NULL,
    valor_entrada DECIMAL(12,2) NULL,
    valor_parcela DECIMAL(12,2) NULL,
    profissao VARCHAR(100) NULL,
    confirmou_presenca VARCHAR(10) NULL,
    ultimo_contato DATE NULL,
    data_visita DATE NULL,
    horario_atendimento TIME NULL,
    observacoes_importantes TEXT NULL,
    consultor VARCHAR(120) NULL,
    consultor_id INT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'Aberto',
    observacao TEXT NULL,
    atendido_em DATETIME NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_leads_consultor_id (consultor_id),
    CONSTRAINT fk_leads_consultor
        FOREIGN KEY (consultor_id)
        REFERENCES usuarios(id)
        ON DELETE SET NULL
);

INSERT INTO usuarios (nome, usuario, senha, tipo)
SELECT 'Administrador', 'admin', 'admin123', 'admin'
WHERE NOT EXISTS (
    SELECT 1
    FROM usuarios
    WHERE usuario = 'admin'
);
