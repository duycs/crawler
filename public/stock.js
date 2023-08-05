(async function () {
    const labels = Utils.months({ count: 7 });
    const data = {
        labels: labels,
        datasets: [{
            label: 'My First Dataset',
            data: [65, 59, 80, 81, 56, 55, 40],
            fill: false,
            borderColor: 'rgb(75, 192, 192)',
            tension: 0.1
        }]
    };

    new Chart(
        document.getElementById('stockLineChart'),
        {
            type: 'bar',
            data: {
                labels: labels,
                datasets: datasets
            }
        }
    );
})();