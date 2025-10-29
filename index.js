require('dotenv').config(); // Carrega as variáveis de ambiente

const express = require("express");
const { Pool } = require("pg");
const bodyParser = require("body-parser");
const app = express();
const PORT = process.env.PORT || 3000;

// Configuração do Middleware
app.use(bodyParser.urlencoded({ extended: true })); // Para ler dados de formulário
app.set("view engine", "ejs"); // Define o EJS como motor de templates
app.use(express.static("public")); // Se você tiver arquivos CSS/JS na pasta 'public'

// Conexão com o PostgreSQL
const db = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Teste inicial de Rota
app.get("/", (req, res) => {
    // Redireciona para o login ou renderiza a página inicial
    res.render("login"); // Vamos começar pela tela de login/registro
});


// Inicia o Servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});