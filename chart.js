// chart.js (LÓGICA DO GOOGLE CHARTS - CORRIGIDO PARA RESPONSIVIDADE)

// 1. Carrega a biblioteca
google.charts.load('current', {'packages':['corechart']});

// 2. Define a função de PREPARAÇÃO para ser chamada quando a biblioteca carregar
google.charts.setOnLoadCallback(setupChart);

// 3. Define a função que desenha o gráfico
function drawChart() {
    // Pega os dados do EJS (lendo do atributo data-*)
    const dataElement = document.getElementById('chart-data');
    if (!dataElement) {
        // Se não houver dados (ex: nenhuma transação), não faz nada.
        return; 
    }

    const fluxoDataString = dataElement.getAttribute('data-fluxocaixa');
    const fluxoData = JSON.parse(fluxoDataString || '[]'); // Converte a string

    // Formata os dados para o Google Charts (Array de Arrays)
    const dataArray = [['Categoria', 'Receitas', 'Despesas']];
    
    // Só executa se tiver dados
    if (fluxoData.length > 0) {
        fluxoData.forEach(item => {
            dataArray.push([
                item.categoria,
                parseFloat(item.receita_total),
                parseFloat(item.despesa_total)
            ]);
        });

        const data = google.visualization.arrayToDataTable(dataArray);

        // Opções de Estilo (com pixels fixos para estabilidade)
        const options = {
            legend: { position: 'top', textStyle: { color: '#495057' } },
            colors: ['#007bff', '#dc3545'], // Azul (Receita), Vermelho (Despesa)
            backgroundColor: 'transparent', 
            
            // Margens internas (em pixels) para o gráfico não cortar
            chartArea: { 
                left: 50,    // <-- Deixa 50px para o "Valor (R$)"
                top: 40,     // <-- Deixa 40px para a Legenda
                right: 20,   // <-- Deixa 20px de "ar" na direita
                bottom: 50   // <-- Deixa 50px para a "Categoria"
            },
            
            vAxis: { 
                title: 'Valor (R$)', 
                minValue: 0, 
                gridlines: { color: '#eee' },
                textStyle: { color: '#6c757d' }
            },
            hAxis: { 
                title: 'Categoria',
                textStyle: { color: '#6c757d' }
            },
            bar: { groupWidth: '80%' }
        };

        // Encontra a div e desenha o gráfico
        const chartElement = document.getElementById('google_chart_div');
        if (chartElement) {
            const chart = new google.visualization.ColumnChart(chartElement);
            chart.draw(data, options);
        }
    }
}

// 4. 🛑 Função que PREPARA o gráfico e o torna responsivo
function setupChart() {
    // Desenha o gráfico pela primeira vez
    drawChart();
    
    // Adiciona o "ouvinte" de redimensionamento
    // Isso força o gráfico a se redesenhar quando a janela muda.
    window.addEventListener('resize', drawChart);
}