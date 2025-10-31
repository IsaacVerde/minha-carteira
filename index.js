require('dotenv').config(); 

const path = require('path');
const express = require("express");
const { Pool } = require("pg");
const bodyParser = require("body-parser");
const app = express();
const PORT = process.env.PORT || 3000;
const bcrypt = require('bcrypt');
const saltRounds = 10; 
const session = require('express-session');


// Variáveis de lista (Definidas globalmente para uso em EJS)
const categorias = ['Alimentação', 'Transporte', 'Moradia', 'Lazer', 'Saúde', 'Salário', 'Outros'];
const metodosPagamento = ['Cartão de Crédito', 'Débito', 'Dinheiro', 'PIX', 'Boleto'];
const statusList = ['Pago', 'A Pagar / Pendente']; 

// Configuração do Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json()); 
app.set("view engine", "ejs");

// 🛑 CORREÇÃO CRÍTICA DE CAMINHO: (Para a sua estrutura de arquivos)
// 1. Serve a pasta Raiz (para /chart.js)
app.use(express.static(__dirname)); 
// 2. Serve a pasta 'public' (para /css/styles.css)
app.use(express.static(path.join(__dirname, 'public'))); 


// Conexão com o PostgreSQL (CORRIGIDO PARA SUPABASE/NUVEM)
const db = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: {
        rejectUnauthorized: false // Necessário para a Vercel se conectar ao Supabase
    }
});

// Configuração do Middleware de Sessão
app.use(session({
    secret: process.env.SESSION_SECRET || '4faYZfS3IStvEfP',
    resave: false,
    saveUninitialized: true,
    cookie: { 
        maxAge: 600000,
        secure: process.env.NODE_ENV === 'production'
    }
}));

// Middleware de Autenticação
const requireAuth = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        return res.redirect("/login");
    }
};

// Função para testar a conexão com o banco de dados
async function testDbConnection() {
    try {
        await db.query('SELECT NOW()');
        console.log("✅ Conexão com PostgreSQL bem-sucedida!");
    } catch (err) {
        console.error("❌ ERRO FATAL: Falha na conexão com o PostgreSQL!");
        console.error("Detalhes do Erro:", err.message);
    }
}
testDbConnection(); 

// ------------------------------------------------------------------
// ROTAS DE AUTENTICAÇÃO (Adaptadas para /dashboard unificado)
// ------------------------------------------------------------------

// GET /register agora redireciona, pois a view "register.ejs" não existe mais
app.get("/register", (req, res) => { 
    res.redirect("/dashboard"); 
});

app.post("/register", async (req, res) => {
    const { email, password } = req.body;
    try {
        const checkResult = await db.query("SELECT * FROM usuarios WHERE email = $1", [email]);
        
        if (checkResult.rows.length > 0) {
            // MUDANÇA: Redireciona de volta ao dashboard com erro
            return res.redirect("/dashboard?err=Este_email_ja_esta_registrado._Tente_fazer_login.");
        }

        const senha_hash = await bcrypt.hash(password, saltRounds); 
        await db.query("INSERT INTO usuarios (email, senha_hash) VALUES ($1, $2)", [email, senha_hash]);
        
        // MUDANÇA: Redireciona ao dashboard com mensagem de sucesso
        return res.redirect("/dashboard?msg=Conta_criada_com_sucesso!_Faca_o_login."); 

    } catch (err) {
        console.error("Erro no registro:", err.message);
        // MUDANÇA: Redireciona de volta ao dashboard com erro
        return res.redirect("/dashboard?err=Ocorreu_um_erro_interno._Tente_novamente.");
    }
});

// GET /login agora redireciona, pois a view "login.ejs" não existe mais
app.get("/login", (req, res) => { 
    res.redirect("/dashboard"); 
});

app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await db.query("SELECT * FROM usuarios WHERE email = $1", [email]);

        if (result.rows.length === 0) {
            // MUDANÇA: Redireciona de volta ao dashboard com erro
            return res.redirect("/dashboard?err=Email_ou_senha_incorretos.");
        }

        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.senha_hash);
        
        if (match) {
            req.session.user = { id: user.id, email: user.email };
            // CORRETO: Esta rota já redirecionava para /dashboard
            return res.redirect("/dashboard");
        } else {
            // MUDANÇA: Redireciona de volta ao dashboard com erro
            return res.redirect("/dashboard?err=Email_ou_senha_incorretos.");
        }
    } catch (err) {
        console.error("Erro no login:", err.message);
        // MUDANÇA: Redireciona de volta ao dashboard com erro
        return res.redirect("/dashboard?err=Ocorreu_um_erro_interno_durante_o_login.");
    }
});

app.post("/logout", (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error("Erro ao destruir a sessão:", err);
        }
        // Limpa o cookie da sessão para garantir o logout completo
        res.clearCookie('connect.sid'); 
        
        // MUDANÇA: Redireciona para /dashboard com mensagem de sucesso
        return res.redirect("/dashboard?msg=Logout_realizado_com_sucesso.");
    });
});

// ------------------------------------------------------------------
// ROTA PROTEGIDA: DASHBOARD (COM FILTRO DUPLO E CORREÇÃO DE ESCOPO)
// ------------------------------------------------------------------

app.get("/dashboard", async (req, res) => {
    
    // 1. Lógica de Mensagem (Movida para fora)
    // Isso é lido em ambos os casos (logado ou não)
    const message = req.query.msg ? decodeURIComponent(req.query.msg).replace(/_/g, ' ') : (
        req.query.err ? decodeURIComponent(req.query.err).replace(/_/g, ' ') : null
    );

    // 2. VERIFICAÇÃO DE AUTENTICAÇÃO
    if (req.session.user) {
        // ===================================
        // ===== USUÁRIO ESTÁ LOGADO =====
        // ===================================
        
        // Todo o seu código existente vai aqui dentro
        try {
            const userId = req.session.user.id; 
            const today = new Date(); 

            // --- Lógica de Filtro Duplo ---
            const calendarFilter = req.query.month_year_filter;
            let currentFilter = req.query.period_filter || 'current_month';
            let periodTitle = "Resumo do Mês Atual"; 
            let startDate, endDate;
            let currentMonthYear;

            // --- LÓGICA DE FILTRO: O Calendário tem prioridade ---
            if (calendarFilter && calendarFilter !== '') {
                // A. FILTRO POR MÊS ESPECÍFICO
                let selectedYear = parseInt(calendarFilter.substring(0, 4));
                let selectedMonth = parseInt(calendarFilter.substring(5, 7));
                startDate = new Date(selectedYear, selectedMonth - 1, 1);
                endDate = new Date(selectedYear, selectedMonth, 0, 23, 59, 59);
                periodTitle = new Date(selectedYear, selectedMonth - 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
                currentFilter = 'custom_month'; 
                currentMonthYear = calendarFilter;
                
            } else {
                // B. FILTROS RELATIVOS OU PADRÃO
                endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
                currentMonthYear = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

                switch (currentFilter) {
                    case '7_days':
                        startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
                        periodTitle = "Últimos 7 dias";
                        break;
                    case '30_days':
                        startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30);
                        periodTitle = "Últimos 30 dias";
                        break;
                    case '12_months':
                        startDate = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
                        periodTitle = "Últimos 12 meses";
                        break;
                    case 'all_time':
                        startDate = new Date(1970, 0, 1);
                        periodTitle = "Todo o Período";
                        break;
                    case 'current_month':
                    default:
                        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
                        periodTitle = new Date(today.getFullYear(), today.getMonth()).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
                        currentFilter = 'current_month';
                        break;
                }
            }
            
            const sqlStartDate = startDate.toISOString();
            const sqlEndDate = endDate.toISOString();
            const monthYearString = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;

            // --- Declaração de variáveis ---
            let todasTransacoes = [];
            let fluxoDeCaixaPorCategoria = [];
            let orcamentoDetalhado = [];
            let resumoData = {};
            let totalOrcamentoPrevisto = 0;
            let total_receitas = 0;
            let total_despesas = 0;
            let receitasNum = 0;
            let despesasNum = 0;
            let orcPrevistoNum = 0;

            // --- Bloco de Queries (seu código original) ---
            try {
                // QUERY 1 & 2: RESUMO
                const resumoResult = await db.query(
                    `SELECT COALESCE(SUM(CASE WHEN tipo = 'Receita' THEN valor ELSE 0 END), 0) AS total_receitas,
                     COALESCE(SUM(CASE WHEN tipo = 'Despesa' THEN valor ELSE 0 END), 0) AS total_despesas
                     FROM transacoes WHERE usuario_id = $3 AND data_transacao BETWEEN $1 AND $2;`,
                    [sqlStartDate, sqlEndDate, userId]
                );
                total_receitas = resumoResult.rows[0].total_receitas;
                total_despesas = resumoResult.rows[0].total_despesas;

                // QUERY 3: ORÇAMENTO PREVISTO
                const orcPrevistoResult = await db.query(
                    `SELECT COALESCE(SUM(valor_orcado), 0) AS total_previsto FROM orcamento_mensal 
                     WHERE usuario_id = $1 AND mes_ano = $2;`, [userId, monthYearString] );
                totalOrcamentoPrevisto = orcPrevistoResult.rows[0].total_previsto; 

                // QUERY 4: TODAS AS TRANSAÇÕES
                const transacoesResult = await db.query(
                    `SELECT id, nome, valor, tipo, categoria, TO_CHAR(data_transacao, 'DD/MM/YYYY') AS data_formatada,
                     metodo_pagamento, status FROM transacoes WHERE usuario_id = $3
                     AND data_transacao BETWEEN $1 AND $2
                     ORDER BY data_transacao DESC, id DESC;`,
                    [sqlStartDate, sqlEndDate, userId]
                );
                todasTransacoes = transacoesResult.rows; 

                // QUERY 5: FLUXO DE CAIXA (Gráfico)
                const fluxoDeCaixaCatResult = await db.query(
                    `SELECT categoria,
                     COALESCE(SUM(CASE WHEN tipo = 'Receita' THEN valor ELSE 0 END), 0) AS receita_total,
                     COALESCE(SUM(CASE WHEN tipo = 'Despesa' THEN valor ELSE 0 END), 0) AS despesa_total
                     FROM transacoes
                     WHERE usuario_id = $3 AND data_transacao BETWEEN $1 AND $2
                     GROUP BY categoria
                     HAVING COALESCE(SUM(CASE WHEN tipo = 'Receita' THEN valor ELSE 0 END), 0) > 0 OR 
                            COALESCE(SUM(CASE WHEN tipo = 'Despesa' THEN valor ELSE 0 END), 0) > 0
                     ORDER BY categoria;`,
                    [sqlStartDate, sqlEndDate, userId]
                );
                fluxoDeCaixaPorCategoria = fluxoDeCaixaCatResult.rows; 
                
                // QUERY 6: ORÇAMENTO DETALHADO
                const orcamentoDetResult = await db.query(
                    `SELECT o.categoria, o.valor_orcado, COALESCE(SUM(t.valor), 0) AS total_gasto
                     FROM orcamento_mensal o LEFT JOIN transacoes t ON o.categoria = t.categoria
                         AND t.usuario_id = o.usuario_id AND t.tipo = 'Despesa'
                         AND t.data_transacao BETWEEN $3 AND $4
                     WHERE o.usuario_id = $1 AND o.mes_ano = $2 GROUP BY o.categoria, o.valor_orcado ORDER BY o.categoria;`,
                    [userId, monthYearString, sqlStartDate, sqlEndDate]
                );
                orcamentoDetalhado = orcamentoDetResult.rows; 

                // --- CÁLCULOS FINAIS ---
                receitasNum = parseFloat(total_receitas);
                despesasNum = parseFloat(total_despesas);
                orcPrevistoNum = parseFloat(totalOrcamentoPrevisto);
                
                resumoData = {
                    totalReceitas: receitasNum.toFixed(2),
                    totalDespesas: despesasNum.toFixed(2),
                    saldo: (receitasNum - despesasNum).toFixed(2),
                    orcamentoRestante: (orcPrevistoNum - despesasNum).toFixed(2),
                };

            } catch (err) {
                console.error("Erro ao carregar dashboard (Queries):", err.message);
                resumoData = { totalReceitas: "0.00", totalDespesas: "0.00", saldo: "0.00", orcamentoRestante: "0.00" };
            }

            // --- RENDERIZAÇÃO (LOGADO) ---
            res.render("dashboard", {
                user: req.session.user,
                resumo: resumoData,
                todasTransacoes: todasTransacoes,
                fluxoDeCaixaPorCategoria: fluxoDeCaixaPorCategoria,
                orcamentoDetalhado: orcamentoDetalhado,
                message: message, // Passa a mensagem (ex: "Transação adicionada")
                periodTitle: periodTitle,
                currentFilter: currentFilter,
                currentMonthYear: currentMonthYear 
            });

        } catch (globalErr) {
            // Se um erro acontecer ANTES do try/catch das queries
            console.error("Erro fatal ao carregar dashboard:", globalErr.message);
            // Redireciona para o logout para limpar a sessão se algo quebrou
            res.redirect("/logout");
        }

    } else {
        // ===================================
        // ===== USUÁRIO NÃO ESTÁ LOGADO =====
        // ===================================
        
        // Renderiza a mesma view, mas sem dados
        res.render("dashboard", {
            user: null,
            message: message // Passa a mensagem (ex: "Senha incorreta", "Logout com sucesso")
        });
    }
});

// ------------------------------------------------------------------
// ROTA POST: NOVA TRANSAÇÃO (COM PERSISTÊNCIA DE FILTRO DUPLO)
// ------------------------------------------------------------------
app.post("/transactions", requireAuth, async (req, res) => {
    const userId = req.session.user.id; 
    // 🛑 Captura AMBOS os filtros
    const { name, value, type, category, transaction_date, payment_method, status, 
            current_filter, month_year_filter } = req.body;

    // 🛑 Lógica de persistência: Prioriza o calendário
    const filterQuery = month_year_filter ? `&month_year_filter=${month_year_filter}` : `&period_filter=${current_filter}`;

    try {
        const parsedValue = parseFloat(value);
        if (isNaN(parsedValue) || parsedValue <= 0) {
             throw new Error("Valor da transação inválido ou menor que zero.");
        }
        await db.query(
            `INSERT INTO transacoes 
             (usuario_id, nome, valor, tipo, categoria, data_transacao, metodo_pagamento, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [userId, name, parsedValue, type, category, transaction_date, payment_method, status]
        );
        return res.redirect(`/dashboard?msg=Transacao_adicionada_com_sucesso!${filterQuery}`);
    } catch (err) {
        console.error("ERRO FATAL ao adicionar transação:", err.message); 
        return res.redirect(`/dashboard?err=Falha_ao_adicionar_transacao.${filterQuery}`);
    }
});

// ------------------------------------------------------------------
// ROTA POST: DELETAR TRANSAÇÃO (COM PERSISTÊNCIA DE FILTRO DUPLO)
// ------------------------------------------------------------------
app.post("/transactions/delete", requireAuth, async (req, res) => {
    const { id, current_filter, month_year_filter } = req.body;
    const userId = req.session.user.id; 

    const filterQuery = month_year_filter ? `&month_year_filter=${month_year_filter}` : `&period_filter=${current_filter}`;

    try {
        await db.query(
            "DELETE FROM transacoes WHERE id = $1 AND usuario_id = $2",
            [id, userId]
        );
        return res.redirect(`/dashboard?msg=Transacao_removida_com_sucesso!${filterQuery}`);
    } catch (err) {
        console.error("Erro ao deletar transação:", err.message);
        return res.redirect(`/dashboard?err=Falha_ao_remover_transacao.${filterQuery}`);
    }
});

// ------------------------------------------------------------------
// ROTA GET: CARREGAR DADOS DA TRANSAÇÃO PARA EDIÇÃO (COM PERSISTÊNCIA DE FILTRO DUPLO)
// ------------------------------------------------------------------
app.get("/transactions/edit/:id", requireAuth, async (req, res) => {
    const transactionId = req.params.id;
    const userId = req.session.user.id;
    // 🛑 Captura AMBOS os filtros da URL
    const filter = req.query.filter || 'current_month';
    const monthFilter = req.query.month_filter;

    try {
        const result = await db.query(
            `SELECT *, TO_CHAR(data_transacao, 'YYYY-MM-DD') AS data_bd 
             FROM transacoes WHERE id = $1 AND usuario_id = $2`,
            [transactionId, userId]
        );

        if (result.rows.length === 0) {
            return res.redirect(`/dashboard?err=Transacao_nao_encontrada.&period_filter=${filter}&month_year_filter=${monthFilter}`);
        }
        
        const transacao = result.rows[0];

        res.render("edit_transaction.ejs", {
            transacao: transacao,
            categorias: categorias, 
            metodosPagamento: metodosPagamento,
            statusList: statusList,
            currentFilter: filter, // Passa o filtro de select
            currentMonthYear: monthFilter // Passa o filtro de calendário
        });

    } catch (err) {
        console.error("Erro ao buscar transação para edição:", err.message);
        return res.redirect(`/dashboard?err=Falha_ao_carregar_dados_de_edicao.&period_filter=${filter}&month_year_filter=${monthFilter}`);
    }
});

// ------------------------------------------------------------------
// ROTA POST: ATUALIZAR (EDITAR) TRANSAÇÃO (COM PERSISTÊNCIA DE FILTRO DUPLO)
// ------------------------------------------------------------------
app.post("/transactions/edit", requireAuth, async (req, res) => {
    const { id, nome, valor, tipo, categoria, data_transacao, metodo_pagamento, status, 
            current_filter, month_year_filter } = req.body; 
    const userId = req.session.user.id; 

    const filterQuery = month_year_filter ? `&month_year_filter=${month_year_filter}` : `&period_filter=${current_filter}`;

    try {
        await db.query(
            `UPDATE transacoes
             SET nome = $1, valor = $2, tipo = $3, categoria = $4, data_transacao = $5, metodo_pagamento = $6, status = $7
             WHERE id = $8 AND usuario_id = $9`,
            [nome, valor, tipo, categoria, data_transacao, metodo_pagamento, status, id, userId] 
        );
        
        return res.redirect(`/dashboard?msg=Transacao_atualizada_com_sucesso!${filterQuery}`);
    } catch (err) {
        console.error("Erro ao atualizar transação:", err.message);
        return res.redirect(`/dashboard?err=Falha_ao_atualizar_transacao.${filterQuery}`);
    }
});

// Rotas de entrada
app.get("/", (req, res) => { res.redirect("/register"); });

// Inicia o Servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});