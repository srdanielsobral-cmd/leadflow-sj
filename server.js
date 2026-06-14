const express = require("express");

const mysql = require("mysql2");

const fs = require("fs");

const path = require("path");

const app = express();

function carregarEnv(){

    const envPath =
    path.join(__dirname, ".env");

    if(!fs.existsSync(envPath)){

        return;

    }

    fs.readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .forEach((linha)=>{

        const texto =
        linha.trim();

        if(!texto || texto.startsWith("#")){

            return;

        }

        const indiceIgual =
        texto.indexOf("=");

        if(indiceIgual == -1){

            return;

        }

        const chave =
        texto.slice(0, indiceIgual).trim();

        const valor =
        texto.slice(indiceIgual + 1).trim().replace(/^["']|["']$/g, "");

        if(chave && process.env[chave] === undefined){

            process.env[chave] = valor;

        }

    });

}

carregarEnv();

const PORT =
process.env.PORT || 3000;

const HOST =
process.env.RAILWAY_ENVIRONMENT ||
process.env.RAILWAY_PROJECT_ID
? "0.0.0.0"
: process.env.HOST || "0.0.0.0";

app.use(express.json({ limit:"10mb" }));

app.use((req,res,next)=>{

    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    next();

});

const publicPath =
path.join(__dirname, "public");

app.get("/", (req,res)=>{

    res.redirect("/login");

});

app.get("/login.html", (req,res)=>{

    res.redirect("/login");

});

app.get("/index.html", (req,res)=>{

    res.redirect("/sistema");

});

app.get("/login", (req,res)=>{

    res.sendFile(path.join(publicPath, "login.html"));

});

app.get("/sistema", (req,res)=>{

    res.sendFile(path.join(publicPath, "index.html"));

});

app.use(express.static("public"));



function configBanco(){

    const urlBanco =
    process.env.DATABASE_URL ||
    process.env.MYSQL_URL;

    if(urlBanco){
        return urlBanco;
    }

    const sslAtivo =
    ["1", "true", "sim", "yes"].includes(
        String(process.env.DB_SSL || process.env.MYSQL_SSL || "")
        .trim()
        .toLowerCase()
    );

    const rejeitarNaoAutorizado =
    !["0", "false", "nao", "no"].includes(
        String(process.env.DB_SSL_REJECT_UNAUTHORIZED || "")
        .trim()
        .toLowerCase()
    );

    return {

        host:
        process.env.DB_HOST ||
        process.env.MYSQLHOST ||
        process.env.MYSQL_HOST ||
        "localhost",

        port:Number(
            process.env.DB_PORT ||
            process.env.MYSQLPORT ||
            process.env.MYSQL_PORT ||
            3306
        ),

        user:
        process.env.DB_USER ||
        process.env.MYSQLUSER ||
        process.env.MYSQL_USER ||
        "root",

        password:
        process.env.DB_PASSWORD ||
        process.env.MYSQLPASSWORD ||
        process.env.MYSQL_PASSWORD ||
        "sj123456",

        database:
        process.env.DB_NAME ||
        process.env.MYSQLDATABASE ||
        process.env.MYSQL_DATABASE ||
        "sj_sistema",

        connectTimeout:10000,

        ssl: sslAtivo
        ? {
            rejectUnauthorized:rejeitarNaoAutorizado
        }
        : undefined

    };

}

function configPoolBanco(){

    const config =
    configBanco();

    if(typeof config == "string"){
        return config;
    }

    return {
        ...config,
        waitForConnections:true,
        connectionLimit:10,
        queueLimit:0
    };

}

function inicializarBancoLocal(callback){

    const config =
    configBanco();

    if(typeof config == "string"){
        callback();
        return;
    }

    const nomeBanco =
    config.database;

    const conexaoInicial =
    mysql.createConnection({
        host:config.host,
        port:config.port,
        user:config.user,
        password:config.password,
        ssl:config.ssl,
        connectTimeout:config.connectTimeout
    });

    conexaoInicial.connect((connectErr)=>{

        if(connectErr){
            console.log(connectErr);
            callback();
            return;
        }

        const sqls = [
            `CREATE DATABASE IF NOT EXISTS ${mysql.escapeId(nomeBanco)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
            `USE ${mysql.escapeId(nomeBanco)}`,
            `
            CREATE TABLE IF NOT EXISTS usuarios (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nome VARCHAR(120) NOT NULL,
                usuario VARCHAR(80) NOT NULL UNIQUE,
                senha VARCHAR(120) NOT NULL,
                foto_perfil LONGTEXT NULL,
                tipo VARCHAR(20) NOT NULL DEFAULT 'consultor',
                criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            `,
            `
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
                INDEX idx_leads_consultor_id (consultor_id)
            )
            `
        ];

        function executarProxima(indice){

            if(indice >= sqls.length){
                conexaoInicial.end();
                callback();
                return;
            }

            conexaoInicial.query(sqls[indice], (err)=>{

                if(err){
                    console.log(err);
                    conexaoInicial.end();
                    callback();
                    return;
                }

                executarProxima(indice + 1);

            });

        }

        executarProxima(0);

    });

}

const db = mysql.createPool(configPoolBanco());

function executarAlteracoesTabela(tabela,colunas,callback){

    function executarProxima(indice){

        if(indice >= colunas.length){

            if(callback){
                callback();
            }

            return;

        }

        db.query(

            `
            ALTER TABLE ${tabela}
            ${colunas[indice]}
            `,

            (err)=>{

                if(
                    err &&
                    err.code != "ER_DUP_FIELDNAME"
                ){

                    console.log(err);

                }

                executarProxima(indice + 1);

            }

        );

    }

    executarProxima(0);

}

function preencherAtendidosSemData(){

    db.query(

        `
        UPDATE leads
        SET atendido_em = NOW()
        WHERE status = 'Atendido'
        AND atendido_em IS NULL
        `,

        (err)=>{

            if(err){

                console.log(err);

            }

        }

    );

}

function garantirColunasLeads(callback){

    const colunas = [
        "ADD COLUMN status_cliente VARCHAR(30) NULL",
        "ADD COLUMN interesse_imovel VARCHAR(30) NULL",
        "ADD COLUMN possui_fgts VARCHAR(10) NULL",
        "ADD COLUMN score_aproximado VARCHAR(20) NULL",
        "ADD COLUMN valor_entrada DECIMAL(12,2) NULL",
        "ADD COLUMN valor_parcela DECIMAL(12,2) NULL",
        "ADD COLUMN profissao VARCHAR(100) NULL",
        "ADD COLUMN confirmou_presenca VARCHAR(10) NULL",
        "ADD COLUMN ultimo_contato DATE NULL",
        "ADD COLUMN data_visita DATE NULL",
        "ADD COLUMN horario_atendimento TIME NULL",
        "ADD COLUMN observacoes_importantes TEXT NULL",
        "ADD COLUMN atendido_em DATETIME NULL"
    ];

    executarAlteracoesTabela("leads", colunas, callback);

}

function garantirColunasUsuarios(callback){

    const colunas = [
        "ADD COLUMN foto_perfil LONGTEXT NULL",
        "ADD COLUMN tipo VARCHAR(20) NOT NULL DEFAULT 'consultor'"
    ];

    executarAlteracoesTabela("usuarios", colunas, ()=>{

        const usuarioAdmin =
        process.env.ADMIN_USUARIO || "admin";

        db.query(

            `
            UPDATE usuarios
            SET tipo = 'admin'
            WHERE id = (
                SELECT primeiro_id
                FROM (
                    SELECT MIN(id) AS primeiro_id
                    FROM usuarios
                ) primeiro_usuario
            )
            `,

            (err)=>{

                if(err){

                    console.log(err);

                }

                if(callback){
                    db.query(

                        `
                        UPDATE usuarios
                        SET tipo = 'admin'
                        WHERE LOWER(TRIM(usuario)) = LOWER(?)
                        `,

                        [usuarioAdmin],

                        (adminUsuarioErr)=>{

                            if(adminUsuarioErr){

                                console.log(adminUsuarioErr);

                            }

                            callback();

                        }

                    );
                }

            }

        );

    });

}

function garantirAdminPadrao(){

    const usuarioAdmin =
    process.env.ADMIN_USUARIO || "admin";

    const senhaAdmin =
    process.env.ADMIN_SENHA || "admin123";

    db.query(

        `
        SELECT id
        FROM usuarios
        WHERE tipo = 'admin'
        LIMIT 1
        `,

        (adminErr,admins)=>{

            if(adminErr){

                console.log(adminErr);
                return;

            }

            if(admins.length > 0){

                return;

            }

            db.query(

                `
                INSERT INTO usuarios (nome, usuario, senha, tipo)
                VALUES ('Administrador', ?, ?, 'admin')
                ON DUPLICATE KEY UPDATE
                    nome = VALUES(nome),
                    senha = VALUES(senha),
                    tipo = 'admin'
                `,

                [
                    usuarioAdmin,
                    senhaAdmin
                ],

                (err)=>{

                    if(err){

                        console.log(err);
                        return;

                    }

                    console.log("Admin padrao recuperado");

                }

            );

        }

    );

}

function resetarAdminSeSolicitado(){

    if(process.env.RESET_ADMIN != "1"){

        return;

    }

    const usuarioAdmin =
    process.env.ADMIN_USUARIO || "admin";

    const senhaAdmin =
    process.env.ADMIN_SENHA || "admin123";

    db.query(

        `
        INSERT INTO usuarios (nome, usuario, senha, tipo)
        VALUES ('Administrador', ?, ?, 'admin')
        ON DUPLICATE KEY UPDATE
            nome = VALUES(nome),
            senha = VALUES(senha),
            tipo = 'admin'
        `,

        [
            usuarioAdmin,
            senhaAdmin
        ],

        (err)=>{

            if(err){

                console.log(err);
                return;

            }

            console.log("Admin resetado por RESET_ADMIN=1");

        }

    );

}



inicializarBancoLocal(()=>{

db.getConnection((err,connection)=>{

    if(err){

       console.log(err);

        return;

    }

    connection.release();

    console.log("MySQL conectado");

    garantirColunasLeads(()=>{

        garantirColunasUsuarios(()=>{

            garantirAdminPadrao();
            resetarAdminSeSolicitado();
            preencherAtendidosSemData();

        });

    });

});





app.post("/lead",(req,res)=>{

    const {

    nome,
    local,
    telefone,
    origem,
    status_cliente,
    interesse_imovel,
    possui_fgts,
    score_aproximado,
    valor_entrada,
    valor_parcela,
    profissao,
    confirmou_presenca,
    ultimo_contato,
    data_visita,
    horario_atendimento,
    observacoes_importantes,
    consultor,
    consultor_id

} = req.body;


    db.query(

        `
        INSERT INTO leads
        (
            nome,
            local_desejado,
            telefone,
            origem,
            status_cliente,
            interesse_imovel,
            possui_fgts,
            score_aproximado,
            valor_entrada,
            valor_parcela,
            profissao,
            confirmou_presenca,
            ultimo_contato,
            data_visita,
            horario_atendimento,
            observacoes_importantes,
            consultor,
            status,
            consultor_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,

        [
            nome,
            local,
            telefone,
            origem,
            status_cliente,
            interesse_imovel,
            possui_fgts,
            score_aproximado,
            valor_entrada || null,
            valor_parcela || null,
            profissao,
            confirmou_presenca,
            ultimo_contato || null,
            data_visita || null,
            horario_atendimento || null,
            observacoes_importantes,
            consultor,
            "Aberto",
            consultor_id
        ],

        (err)=>{

            if(err){

                console.log(err);

                res.send("erro");

                return;

            }

            res.send("Lead salvo");

        }

    );

});





app.get("/leads",(req,res)=>{

    const consultor_id =
    req.query.consultor_id;

    const admin_id =
    req.query.admin_id;

    function consultarLeads(sql, parametros){

        db.query(

            sql,

            parametros,

            (err,result)=>{

                if(err){

                    console.log(err);

                    res.send([]);

                    return;

                }

                res.json(result);

            }

        );

    }

    if(consultor_id == "all" && admin_id){

        verificarAdmin(
            admin_id,
            (admin)=>{

                if(!admin){
                    res.status(403).send([]);
                    return;
                }

                consultarLeads(
                    "SELECT * FROM leads ORDER BY id DESC",
                    []
                );

            }

        );

        return;

    }

    consultarLeads(
        `
        SELECT * FROM leads
        WHERE consultor_id = ?
        ORDER BY id DESC
        `,
        [consultor_id]
    );

});

});



function credenciaisAdminEmergencia(usuario,senha){

    const usuarioAdmin =
    String(process.env.ADMIN_USUARIO || "admin").trim();

    const senhaAdmin =
    String(process.env.ADMIN_SENHA || "admin123").trim();

    return (
        usuarioAdmin &&
        senhaAdmin &&
        String(usuario || "").trim().toLowerCase() == usuarioAdmin.toLowerCase() &&
        String(senha || "").trim() == senhaAdmin
    );

}

function responderLoginAdminEmergencia(usuarioLogin, senhaLogin, res){

    db.query(

        `
        SELECT id, nome, usuario, tipo, foto_perfil
        FROM usuarios
        WHERE tipo = 'admin'
        ORDER BY id ASC
        LIMIT 1
        `,

        (adminErr,admins)=>{

            if(adminErr){

                console.log(adminErr);
                res.json({
                    success:false
                });
                return;

            }

            if(admins.length > 0){

                res.json({
                    success:true,
                    usuario:admins[0]
                });
                return;

            }

            db.query(

                `
                INSERT INTO usuarios (nome, usuario, senha, tipo)
                VALUES ('Administrador', ?, ?, 'admin')
                ON DUPLICATE KEY UPDATE
                    nome = VALUES(nome),
                    senha = VALUES(senha),
                    tipo = 'admin'
                `,

                [
                    usuarioLogin,
                    senhaLogin
                ],

                (insertErr)=>{

                    if(insertErr){

                        console.log(insertErr);
                        res.json({
                            success:false
                        });
                        return;

                    }

                    db.query(

                        `
                        SELECT id, nome, usuario, tipo, foto_perfil
                        FROM usuarios
                        WHERE LOWER(TRIM(usuario)) = LOWER(?)
                        LIMIT 1
                        `,

                        [usuarioLogin],

                        (selectErr,usuarios)=>{

                            if(selectErr || usuarios.length == 0){

                                if(selectErr){
                                    console.log(selectErr);
                                }

                                res.json({
                                    success:false
                                });
                                return;

                            }

                            res.json({
                                success:true,
                                usuario:usuarios[0]
                            });

                        }

                    );

                }

            );

        }

    );

}

function responderAcessoLiberado(res){

    responderLoginAdminEmergencia(
        process.env.ADMIN_USUARIO || "leadflow",
        process.env.ADMIN_SENHA || "leadflow",
        res
    );

}




app.post("/login",(req,res)=>{

    const {

        usuario,
        senha

    } = req.body;

    const usuarioLogin =
    String(usuario || "").trim();

    const senhaLogin =
    String(senha || "").trim();

    if(!usuarioLogin && !senhaLogin){

        responderAcessoLiberado(res);
        return;

    }

    if(!usuarioLogin || !senhaLogin){

        res.json({

            success:false

        });

        return;

    }

    if(credenciaisAdminEmergencia(usuarioLogin,senhaLogin)){

        responderLoginAdminEmergencia(usuarioLogin, senhaLogin, res);
        return;

    }



    db.query(

        `
        SELECT id, nome, usuario, tipo, foto_perfil
        FROM usuarios
        WHERE LOWER(TRIM(usuario)) = LOWER(?)
        AND TRIM(senha) = ?
        LIMIT 1
        `,

        [
            usuarioLogin,
            senhaLogin
        ],

        (err,result)=>{

            if(err){

                console.log(err);
                res.json({

                    success:false

                });

                return;

            }



            if(result.length > 0){

                res.json({

                    success:true,

                    usuario:result[0]

                });

            }else{

                res.json({

                    success:false

                });

            }

        }

    );

});

app.put("/usuario/:id",(req,res)=>{

    const id =
    req.params.id;

    const {
        nome,
        senha,
        foto_perfil
    } = req.body;

    const senhaNova =
    typeof senha == "string"
    ? senha.trim()
    : "";

    db.query(

        `
        SELECT *
        FROM usuarios
        WHERE id = ?
        `,

        [id],

        (usuarioErr,usuarios)=>{

            if(usuarioErr || usuarios.length == 0){

                res.json({ success:false });
                return;

            }

            const usuarioAtual =
            usuarios[0];

            const campos = [
                "nome = ?",
                "foto_perfil = ?"
            ];

            const valores = [
                nome,
                foto_perfil || null
            ];

            if(senhaNova){

                campos.push("senha = ?");
                valores.push(senhaNova);

            }

            valores.push(id);

            db.query(

                `
                UPDATE usuarios
                SET ${campos.join(", ")}
                WHERE id = ?
                `,

                valores,

                (err)=>{

                    if(err){

                        console.log(err);
                        res.json({ success:false });
                        return;

                    }

                    function responderUsuarioAtualizado(){

                        db.query(

                            `
                            SELECT * FROM usuarios
                            WHERE id = ?
                            `,

                            [id],

                            (selectErr,result)=>{

                                if(selectErr || result.length == 0){

                                    res.json({ success:false });
                                    return;

                                }

                                res.json({
                                    success:true,
                                    usuario:result[0]
                                });

                            }

                        );

                    }

                    if(!senhaNova){

                        responderUsuarioAtualizado();
                        return;

                    }

                    db.query(

                        `
                        UPDATE usuarios
                        SET senha = ?
                        WHERE usuario = ?
                        `,

                        [
                            senhaNova,
                            usuarioAtual.usuario
                        ],

                        (senhaErr)=>{

                            if(senhaErr){

                                console.log(senhaErr);
                                res.json({ success:false });
                                return;

                            }

                            responderUsuarioAtualizado();

                        }

                    );


                }

            );

        }

    );

});

function verificarAdmin(adminId, callback){

    db.query(

        `
        SELECT id, tipo
        FROM usuarios
        WHERE tipo = 'admin'
        AND (
            id = ?
            OR ? = 1
        )
        LIMIT 1
        `,

        [
            adminId,
            Number(adminId)
        ],

        (err,result)=>{

            callback(
                !err &&
                result.length > 0
            );

        }

    );

}

app.get("/admin/usuarios",(req,res)=>{

    verificarAdmin(
        req.query.admin_id,
        (admin)=>{

            if(!admin){

                res.status(403).json({ success:false });
                return;

            }

            db.query(

                `
                SELECT id, nome, usuario, tipo, foto_perfil
                FROM usuarios
                ORDER BY tipo ASC, nome ASC
                `,

                (err,result)=>{

                    if(err){

                        console.log(err);
                        res.json({ success:false, usuarios:[] });
                        return;

                    }

                    res.json({
                        success:true,
                        usuarios:result
                    });

                }

            );

        }

    );

});

app.post("/admin/usuarios",(req,res)=>{

    const {
        admin_id,
        nome,
        usuario,
        senha
    } = req.body;

    verificarAdmin(
        admin_id,
        (admin)=>{

            if(!admin){

                res.status(403).json({ success:false });
                return;

            }

            const nomeNovo =
            String(nome || "").trim();

            const usuarioNovo =
            String(usuario || "").trim();

            const senhaNova =
            String(senha || "").trim();

            if(!nomeNovo || !usuarioNovo || !senhaNova){

                res.json({
                    success:false,
                    message:"Preencha nome, usuario e senha."
                });
                return;

            }

            db.query(

                `
                SELECT id
                FROM usuarios
                WHERE usuario = ?
                `,

                [usuarioNovo],

                (consultaErr,existentes)=>{

                    if(consultaErr){

                        console.log(consultaErr);
                        res.json({ success:false });
                        return;

                    }

                    if(existentes.length > 0){

                        res.json({
                            success:false,
                            message:"Ja existe uma conta com esse usuario."
                        });
                        return;

                    }

                    db.query(

                        `
                        INSERT INTO usuarios
                        (nome, usuario, senha, tipo)
                        VALUES (?, ?, ?, 'consultor')
                        `,

                        [
                            nomeNovo,
                            usuarioNovo,
                            senhaNova
                        ],

                        (err)=>{

                            if(err){

                                console.log(err);
                                res.json({ success:false });
                                return;

                            }

                            res.json({ success:true });

                        }

                    );

                }

            );

        }

    );

});

app.delete("/admin/usuarios/:id",(req,res)=>{

    const id =
    req.params.id;

    const adminId =
    req.query.admin_id;

    verificarAdmin(
        adminId,
        (admin)=>{

            if(!admin){

                res.status(403).json({ success:false });
                return;

            }

            if(String(id) == String(adminId)){

                res.json({
                    success:false,
                    message:"Nao e possivel excluir o administrador logado."
                });
                return;

            }

            db.query(

                `
                SELECT id, nome
                FROM usuarios
                WHERE id = ?
                `,

                [adminId],

                (adminErr,adminResult)=>{

                    if(adminErr || adminResult.length == 0){

                        res.json({ success:false });
                        return;

                    }

                    const adminNome =
                    adminResult[0].nome;

                    db.query(

                        `
                        UPDATE leads
                        SET consultor_id = ?,
                        consultor = ?
                        WHERE consultor_id = ?
                        `,

                        [
                            adminId,
                            adminNome,
                            id
                        ],

                        (leadsErr)=>{

                            if(leadsErr){

                                console.log(leadsErr);
                                res.json({ success:false });
                                return;

                            }

                            db.query(

                                `
                                DELETE FROM usuarios
                                WHERE id = ?
                                AND tipo = 'consultor'
                                `,

                                [id],

                                (err,result)=>{

                                    if(err){

                                        console.log(err);
                                        res.json({ success:false });
                                        return;

                                    }

                                    res.json({
                                        success:result.affectedRows > 0,
                                        message:
                                        result.affectedRows > 0
                                        ? ""
                                        : "Consultor nao encontrado."
                                    });

                                }

                            );

                        }

                    );

                }

            );

        }

    );

});

function limparTextoPdf(valor){

    return String(valor || "-")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, " ");

}

function escaparTextoPdf(valor){

    return limparTextoPdf(valor)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

}

function criarPdfRelatorio(leads){

    const larguraPagina = 595;
    const alturaPagina = 842;
    const margem = 36;
    const linhasPorPagina = 9;
    const larguraConteudo =
    larguraPagina - margem * 2;

    const total =
    leads.length;

    const atendidos =
    leads.filter((lead)=>lead.status == "Atendido").length;

    const abertos =
    leads.filter((lead)=>lead.status == "Aberto").length;

    const taxa =
    total
    ? Math.round((atendidos / total) * 100)
    : 0;

    const visitas =
    leads.filter((lead)=>lead.data_visita).length;

    const presencas =
    leads.filter((lead)=>String(lead.confirmou_presenca || "").toLowerCase() == "sim").length;

    const consultor =
    leads[0] && leads[0].consultor
    ? leads[0].consultor
    : "Consultor";

    function itemMaisFrequente(campo){

        const contagem = {};

        leads.forEach((lead)=>{

            const valor =
            limparTextoPdf(lead[campo] || "");

            if(!valor || valor == "-"){
                return;
            }

            contagem[valor] =
            (contagem[valor] || 0) + 1;

        });

        const itens =
        Object.entries(contagem)
        .sort((a,b)=>b[1] - a[1]);

        return itens[0] || ["-", 0];

    }

    const origemPrincipal =
    itemMaisFrequente("origem");

    const regiaoPrincipal =
    itemMaisFrequente("local_desejado");

    const paginas = [];

    for(
        let indice = 0;
        indice < Math.max(leads.length, 1);
        indice += linhasPorPagina
    ){

        paginas.push(
            leads.slice(indice, indice + linhasPorPagina)
        );

    }

    function numeroPdf(valor){

        return Number(valor).toFixed(2);

    }

    function textoLimitado(valor, tamanho){

        const texto =
        limparTextoPdf(valor);

        if(texto.length <= tamanho){
            return texto;
        }

        return texto.slice(0, tamanho - 3) + "...";

    }

    function dataPdf(valor){

        if(!valor){
            return "-";
        }

        if(typeof valor == "string" && /^\d{4}-\d{2}-\d{2}/.test(valor)){

            const partes =
            valor.slice(0, 10).split("-");

            return `${partes[2]}/${partes[1]}/${partes[0]}`;

        }

        const data =
        new Date(valor);

        if(isNaN(data.getTime())){
            return "-";
        }

        return data.toLocaleDateString("pt-BR");

    }

    function horaPdf(valor){

        if(!valor){
            return "-";
        }

        const texto =
        String(valor);

        const hora =
        texto.match(/(\d{2}):(\d{2})/);

        if(!hora){
            return "-";
        }

        return `${hora[1]}:${hora[2]}`;

    }

    function dataHoraPdf(lead){

        const data =
        dataPdf(lead.data_visita);

        const hora =
        horaPdf(lead.horario_atendimento);

        return hora == "-"
        ? data
        : `${data} ${hora}`;

    }

    function retangulo(comandos, x, y, largura, altura, cor){

        comandos.push(
            `${cor.join(" ")} rg ${numeroPdf(x)} ${numeroPdf(y)} ${numeroPdf(largura)} ${numeroPdf(altura)} re f`
        );

    }

    function borda(comandos, x, y, largura, altura, cor = [.82,.86,.91]){

        comandos.push(
            `${cor.join(" ")} RG ${numeroPdf(x)} ${numeroPdf(y)} ${numeroPdf(largura)} ${numeroPdf(altura)} re S`
        );

    }

    function texto(comandos, valor, x, y, tamanho = 10, fonte = "F1", cor = [0,0,0]){

        comandos.push(
            `BT /${fonte} ${tamanho} Tf ${cor.join(" ")} rg ${numeroPdf(x)} ${numeroPdf(y)} Td (${escaparTextoPdf(valor)}) Tj ET`
        );

    }

    function moedaPdf(valor){

        const numero =
        Number(valor);

        if(!valor || isNaN(numero)){
            return "-";
        }

        return numero.toLocaleString(
            "pt-BR",
            {
                style:"currency",
                currency:"BRL"
            }
        );

    }

    function linha(comandos, x1, y1, x2, y2, cor = [.82,.86,.91]){

        comandos.push(
            `${cor.join(" ")} RG ${numeroPdf(x1)} ${numeroPdf(y1)} m ${numeroPdf(x2)} ${numeroPdf(y2)} l S`
        );

    }

    function linhaEspessa(comandos, x1, y1, x2, y2, largura, cor){

        comandos.push(
            `${largura} w ${cor.join(" ")} RG ${numeroPdf(x1)} ${numeroPdf(y1)} m ${numeroPdf(x2)} ${numeroPdf(y2)} l S 1 w`
        );

    }

    function desenharBarra(comandos, x, y, largura, altura, percentual, cor){

        const larguraPreenchida =
        largura * Math.max(0, Math.min(percentual, 100)) / 100;

        retangulo(comandos, x, y, largura, altura, [.88,.93,.98]);
        retangulo(comandos, x, y, larguraPreenchida, altura, cor);

    }

    function desenharCartao(comandos, titulo, valor, detalhe, x, y, largura, corDestaque){

        retangulo(comandos, x + 2, y - 2, largura, 66, [.88,.91,.96]);
        retangulo(comandos, x, y, largura, 66, [1,1,1]);
        retangulo(comandos, x, y + 60, largura, 6, corDestaque);
        borda(comandos, x, y, largura, 66, [.82,.88,.95]);
        texto(comandos, titulo, x + 12, y + 45, 8, "F2", [.39,.45,.55]);
        texto(comandos, valor, x + 12, y + 22, 22, "F2", [.06,.09,.16]);
        texto(comandos, detalhe, x + 12, y + 9, 7, "F1", [.45,.50,.59]);

    }

    function desenharPill(comandos, valor, x, y, largura, preenchimento, corTexto){

        retangulo(comandos, x, y, largura, 14, preenchimento);
        texto(comandos, valor, x + 6, y + 4, 7, "F2", corTexto);

    }

    function desenharCabecalho(comandos, paginaAtual, totalPaginas){

        retangulo(comandos, 0, 744, larguraPagina, 98, [.04,.07,.13]);
        retangulo(comandos, 0, 744, 118, 98, [.08,.18,.34]);
        retangulo(comandos, 0, 735, larguraPagina, 9, [.15,.39,.92]);
        retangulo(comandos, margem, 785, 42, 34, [1,1,1]);
        texto(comandos, "LF", margem + 8, 797, 15, "F2", [.04,.44,.72]);
        texto(comandos, "LeadFlow", margem + 54, 805, 23, "F2", [1,1,1]);
        texto(comandos, "Relatorio de Leads", margem + 54, 786, 13, "F1", [.79,.86,.96]);
        texto(comandos, `Consultor: ${textoLimitado(consultor, 34)}`, margem + 54, 769, 9, "F1", [.79,.86,.96]);
        retangulo(comandos, 364, 786, 156, 28, [.10,.16,.27]);
        borda(comandos, 364, 786, 156, 28, [.20,.30,.46]);
        texto(
            comandos,
            `Gerado em ${new Date().toLocaleString("pt-BR")}`,
            376,
            804,
            9,
            "F1",
            [.79,.86,.96]
        );
        texto(
            comandos,
            `Pagina ${paginaAtual} de ${totalPaginas}`,
            376,
            792,
            9,
            "F1",
            [.79,.86,.96]
        );

    }

    function desenharResumo(comandos){

        const larguraCartao = 124;
        const espaco = 9;

        texto(comandos, "Resumo executivo", margem, 708, 13, "F2", [.06,.09,.16]);
        texto(comandos, "Panorama visual dos leads cadastrados no sistema.", margem, 694, 8, "F1", [.39,.45,.55]);

        desenharCartao(comandos, "TOTAL", String(total), "Leads cadastrados", margem, 620, larguraCartao, [.15,.39,.92]);
        desenharCartao(comandos, "ATENDIDOS", String(atendidos), `${taxa}% de conversao`, margem + (larguraCartao + espaco), 620, larguraCartao, [.04,.52,.36]);
        desenharCartao(comandos, "EM ABERTO", String(abertos), "Aguardando retorno", margem + (larguraCartao + espaco) * 2, 620, larguraCartao, [.82,.39,.03]);
        desenharCartao(comandos, "VISITAS", String(visitas), `${presencas} presencas conf.`, margem + (larguraCartao + espaco) * 3, 620, larguraCartao, [.49,.27,.91]);

        retangulo(comandos, margem, 566, larguraConteudo, 34, [.94,.97,1]);
        retangulo(comandos, margem, 566, 5, 34, [.15,.39,.92]);
        borda(comandos, margem, 566, larguraConteudo, 34, [.82,.88,.95]);
        texto(comandos, "Origem principal", margem + 16, 586, 8, "F2", [.39,.45,.55]);
        texto(comandos, `${textoLimitado(origemPrincipal[0], 24)} (${origemPrincipal[1]})`, margem + 16, 574, 10, "F2", [.08,.12,.20]);
        linha(comandos, 286, 571, 286, 595, [.82,.88,.95]);
        texto(comandos, "Regiao mais procurada", 304, 586, 8, "F2", [.39,.45,.55]);
        texto(comandos, `${textoLimitado(regiaoPrincipal[0], 28)} (${regiaoPrincipal[1]})`, 304, 574, 10, "F2", [.08,.12,.20]);

        texto(comandos, "Taxa de atendimento", margem, 543, 9, "F2", [.39,.45,.55]);
        desenharBarra(comandos, margem, 529, larguraConteudo - 48, 8, taxa, [.04,.52,.36]);
        texto(comandos, `${taxa}%`, larguraPagina - margem - 34, 527, 12, "F2", [.04,.52,.36]);

    }

    function desenharTabela(comandos, registros){

        const yTitulo = 508;
        const yCabecalho = 448;
        const alturaLinha = 38;

        const colunas = [
            ["Lead", 42],
            ["Contato", 154],
            ["Perfil", 238],
            ["Imovel", 330],
            ["Atendimento", 430],
            ["Agenda", 504]
        ];

        texto(comandos, "Detalhamento dos leads", margem, yTitulo, 12, "F2", [.06,.09,.16]);
        retangulo(comandos, margem, yCabecalho, larguraConteudo, 24, [.08,.18,.34]);
        retangulo(comandos, margem, yCabecalho, 5, 24, [.15,.39,.92]);

        colunas.forEach((coluna)=>{

            texto(comandos, coluna[0], coluna[1], yCabecalho + 8, 8, "F2", [1,1,1]);

        });

        if(registros.length == 0){

            texto(
                comandos,
                "Nenhum lead encontrado para este consultor.",
                margem,
                yCabecalho - 32,
                11,
                "F1",
                [.39,.45,.55]
            );
            return;

        }

        registros.forEach((lead, indice)=>{

            const y =
            yCabecalho - ((indice + 1) * alturaLinha);

            if(indice % 2 == 0){
                retangulo(comandos, margem, y - 6, larguraConteudo, alturaLinha, [.98,.99,1]);
            }else{
                retangulo(comandos, margem, y - 6, larguraConteudo, alturaLinha, [1,1,1]);
            }

            linha(comandos, margem, y - 6, larguraPagina - margem, y - 6, [.89,.92,.96]);

            const statusCor =
            lead.status == "Atendido"
            ? [.04,.52,.36]
            : [.72,.35,.02];

            const statusPreenchimento =
            lead.status == "Atendido"
            ? [.85,.97,.92]
            : [1,.95,.82];

            const observacao =
            lead.observacao || lead.observacoes_importantes || "-";

            linhaEspessa(comandos, margem + 2, y - 1, margem + 2, y + 26, 2, statusCor);
            texto(comandos, textoLimitado(lead.nome, 20), 42, y + 18, 8, "F2", [.08,.12,.20]);
            texto(comandos, textoLimitado(lead.local_desejado, 22), 42, y + 6, 7, "F1", [.39,.45,.55]);
            texto(comandos, textoLimitado(lead.telefone, 15), 154, y + 18, 8, "F1", [.08,.12,.20]);
            texto(comandos, textoLimitado(lead.origem, 15), 154, y + 6, 7, "F1", [.39,.45,.55]);
            texto(comandos, textoLimitado(lead.status_cliente, 16), 238, y + 18, 8, "F1", [.08,.12,.20]);
            texto(comandos, textoLimitado(lead.profissao, 18), 238, y + 6, 7, "F1", [.39,.45,.55]);
            texto(comandos, textoLimitado(lead.interesse_imovel, 16), 330, y + 18, 8, "F1", [.08,.12,.20]);
            texto(comandos, `Entrada: ${textoLimitado(moedaPdf(lead.valor_entrada), 14)}`, 330, y + 6, 7, "F1", [.39,.45,.55]);
            desenharPill(comandos, textoLimitado(lead.status, 10), 430, y + 15, 58, statusPreenchimento, statusCor);
            texto(comandos, `Parc.: ${textoLimitado(moedaPdf(lead.valor_parcela), 12)}`, 430, y + 6, 7, "F1", [.39,.45,.55]);
            texto(comandos, textoLimitado(dataHoraPdf(lead), 16), 504, y + 18, 8, "F1", [.08,.12,.20]);
            texto(comandos, `Pres.: ${textoLimitado(lead.confirmou_presenca, 6)}`, 504, y + 6, 7, "F1", [.39,.45,.55]);
            texto(
                comandos,
                textoLimitado(observacao, 72),
                42,
                y - 3,
                7,
                "F1",
                [.45,.50,.59]
            );

        });

    }

    function desenharRodape(comandos){

        linhaEspessa(comandos, margem, 50, larguraPagina - margem, 50, 2, [.15,.39,.92]);
        linha(comandos, margem, 46, larguraPagina - margem, 46, [.82,.86,.91]);
        texto(comandos, "LeadFlow", margem, 30, 8, "F1", [.39,.45,.55]);
        texto(comandos, "Relatorio gerado automaticamente pelo sistema", 360, 30, 8, "F1", [.39,.45,.55]);

    }

    const objetos = [
        "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
        `2 0 obj << /Type /Pages /Kids [${paginas.map((_,i)=>`${3 + i * 2} 0 R`).join(" ")}] /Count ${paginas.length} >> endobj`
    ];

    paginas.forEach((pagina, indice)=>{

        const paginaId = 3 + indice * 2;
        const conteudoId = paginaId + 1;

        objetos.push(
            `${paginaId} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${larguraPagina} ${alturaPagina}] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> >> >> /Contents ${conteudoId} 0 R >> endobj`
        );

        const comandos = [];

        desenharCabecalho(comandos, indice + 1, paginas.length);
        desenharResumo(comandos);
        desenharTabela(comandos, pagina);
        desenharRodape(comandos);

        const conteudo =
        comandos.join("\n");

        objetos.push(
            `${conteudoId} 0 obj << /Length ${Buffer.byteLength(conteudo)} >> stream\n${conteudo}\nendstream endobj`
        );

    });

    let pdf = "%PDF-1.4\n";
    const offsets = [0];

    objetos.forEach((objeto)=>{

        offsets.push(Buffer.byteLength(pdf));
        pdf += objeto + "\n";

    });

    const xref =
    Buffer.byteLength(pdf);

    pdf += `xref\n0 ${objetos.length + 1}\n`;
    pdf += "0000000000 65535 f \n";

    offsets
    .slice(1)
    .forEach((offset)=>{

        pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;

    });

    pdf += `trailer << /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

    return Buffer.from(pdf);

}

app.get("/relatorio.pdf",(req,res)=>{

    const consultor_id =
    req.query.consultor_id;

    const admin_id =
    req.query.admin_id;

    function gerarRelatorio(sql, parametros){

        db.query(

            sql,

            parametros,

            (err,result)=>{

                if(err){

                    console.log(err);
                    res.status(500).send("erro");
                    return;

                }

                const pdf =
                criarPdfRelatorio(result);

                res.setHeader("Content-Type", "application/pdf");
                res.setHeader("X-PDF-Layout", "detalhamento-v2");
                res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
                res.setHeader("Pragma", "no-cache");
                res.setHeader("Expires", "0");
                res.setHeader(
                    "Content-Disposition",
                    `attachment; filename=relatorio-leads-${Date.now()}.pdf`
                );
                res.send(pdf);

            }

        );

    }

    if(consultor_id == "all" && admin_id){

        verificarAdmin(
            admin_id,
            (admin)=>{

                if(!admin){
                    res.status(403).send("sem permissao");
                    return;
                }

                gerarRelatorio(
                    "SELECT * FROM leads ORDER BY id DESC",
                    []
                );

            }

        );

        return;

    }

    gerarRelatorio(
        `
        SELECT * FROM leads
        WHERE consultor_id = ?
        ORDER BY id DESC
        `,
        [consultor_id]
    );

});

app.put("/lead/:id",(req,res)=>{

    const id =
    req.params.id;

    const {
        nome,
        local,
        telefone,
        origem,
        status_cliente,
        interesse_imovel,
        possui_fgts,
        valor_entrada,
        valor_parcela,
        profissao,
        confirmou_presenca,
        ultimo_contato,
        data_visita,
        horario_atendimento,
        observacoes_importantes,
        observacao,
        status,
        consultor_id
    } = req.body;

    if(!nome || !local || !telefone || !consultor_id){

        res.json({
            success:false,
            message:"Preencha nome, telefone e regiao desejada."
        });
        return;

    }

    db.query(

        `
        UPDATE leads
        SET
            nome = ?,
            local_desejado = ?,
            telefone = ?,
            origem = ?,
            status_cliente = ?,
            interesse_imovel = ?,
            possui_fgts = ?,
            score_aproximado = ?,
            valor_entrada = ?,
            valor_parcela = ?,
            profissao = ?,
            confirmou_presenca = ?,
            ultimo_contato = ?,
            data_visita = ?,
            horario_atendimento = ?,
            observacoes_importantes = ?,
            observacao = ?,
            status = ?,
            atendido_em =
            CASE
                WHEN ? = 'Atendido'
                THEN COALESCE(atendido_em, NOW())
                ELSE NULL
            END
        WHERE id = ?
        AND consultor_id = ?
        `,

        [
            nome,
            local,
            telefone,
            origem,
            status_cliente,
            interesse_imovel,
            possui_fgts,
            valor_entrada ? String(valor_entrada) : "",
            valor_entrada || null,
            valor_parcela || null,
            profissao,
            confirmou_presenca,
            ultimo_contato || null,
            data_visita || null,
            horario_atendimento || null,
            observacoes_importantes,
            observacao,
            status || "Aberto",
            status || "Aberto",
            id,
            consultor_id
        ],

        (err,result)=>{

            if(err){

                console.log(err);
                res.json({ success:false });
                return;

            }

            res.json({
                success:result.affectedRows > 0,
                message:
                result.affectedRows > 0
                ? ""
                : "Cliente nao encontrado."
            });

        }

    );

});
app.delete("/lead/:id",(req,res)=>{

    const id =
    req.params.id;



    db.query(

        `
        DELETE FROM leads
        WHERE id = ?
        `,

        [id],

        (err)=>{

            if(err){

                console.log(err);

                res.send("erro");

                return;

            }

            res.send("Lead apagada");

        }

    );

});
app.put("/status",(req,res)=>{

    const {

        id,
        status,
        observacao

    } = req.body;



    db.query(

        `
        UPDATE leads

        SET

        status = ?,
        observacao = ?,
        atendido_em =
        CASE
            WHEN ? = 'Atendido'
            THEN COALESCE(atendido_em, NOW())
            ELSE NULL
        END

        WHERE id = ?
        `,

        [
            status,
            observacao,
            status,
            id
        ],

        (err)=>{

            if(err){

                console.log(err);

                res.send("erro");

                return;

            }

            res.send("ok");

        }

    );

});

app.put("/lead/:id/presenca",(req,res)=>{

    const id =
    req.params.id;

    const {
        confirmou_presenca
    } = req.body;

    const valor =
    String(confirmou_presenca || "").trim();

    if(!["Sim", "Nao", "Não", ""].includes(valor)){

        res.status(400).json({
            success:false,
            message:"Presenca invalida."
        });
        return;

    }

    db.query(

        `
        UPDATE leads
        SET confirmou_presenca = ?
        WHERE id = ?
        `,

        [
            valor,
            id
        ],

        (err,result)=>{

            if(err){

                console.log(err);
                res.json({ success:false });
                return;

            }

            res.json({
                success:result.affectedRows > 0
            });

        }

    );

});



app.get("/health",(req,res)=>{

    res.json({
        ok:true,
        app:"LeadFlow",
        pdf_layout:"detalhamento-v2",
        consultores_fix:"admin-real-v2"
    });

});

app.listen(PORT,HOST,()=>{

    console.log(`LeadFlow rodando em http://${HOST}:${PORT}`);

});
