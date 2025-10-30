// chart.js (LÓGICA DO GOOGLE CHARTS - NÃO CHART.JS)

// 1. Carrega a biblioteca (pacote 'corechart' para gráficos de barra/coluna)
google.charts.load('current', {'packages':['corechart']});

// 2. Define a função de desenho para ser chamada quando a biblioteca carregar
google.charts.setOnLoadCallback(drawChart);

function drawChart() {
    // 3. Pega os dados do EJS (lendo do atributo data-*)
    const dataElement = document.getElementById('chart-data');
    if (!dataElement) {
        console.error("Elemento 'chart-data' não encontrado.");
        return; 
    }

    const fluxoDataString = dataElement.getAttribute('data-fluxocaixa');
    const fluxoData = JSON.parse(fluxoDataString || '[]'); // Converte a string

    // 4. Formata os dados para o Google Charts (Array de Arrays)
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

        // 5. Opções de Estilo (Paleta Azul/Vermelho)
        const options = {
            legend: { position: 'top', textStyle: { color: '#495057' } },
            colors: ['#007bff', '#dc3545'], // Azul (Receita), Vermelho (Despesa)
            backgroundColor: 'transparent', 
            chartArea: {width: '85%', height: '70%'},
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

        // 6. Encontra a div e desenha o gráfico
        const chartElement = document.getElementById('google_chart_div');
        if (chartElement) {
            const chart = new google.visualization.ColumnChart(chartElement);
            chart.draw(data, options);
        } else {
            console.error("Elemento 'google_chart_div' não encontrado para desenhar o gráfico.");
        }
    }
}