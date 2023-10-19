<script>
    import { onMount } from 'svelte';
    import { apiGet } from 'wp-ajax';
    import { Bar } from 'svelte-chartjs';
    import 'chartjs-adapter-date-fns';
    import { enUS } from 'date-fns/locale'; 
    import {
        Chart as ChartJS,
        Title,
        Tooltip,
        Legend,
        LineElement,
        BarElement,
        LinearScale,
        PointElement,
        CategoryScale,
        Colors,
        TimeScale,
    } from 'chart.js';

    ChartJS.register(
        Title,
        Tooltip,
        Legend,
        LineElement,
        BarElement,
        LinearScale,
        PointElement,
        CategoryScale,
        Colors,
        TimeScale,
    );

    const day_map = d => {
        return {
            x: d.date,
            y: d.count,
        };
    };

    export let datasets = [];
    export let type_id;

    //onMount
    onMount(async () => {
        const report = await apiGet(`summaryengine/v1/report/by_period?type=${type_id || -1}`);
        datasets = [
            {
                label: 'Approved',
                data: report.filter(d => Number(d.rating) === 1).map(day_map),
            },
            {
                label: 'Disappproved',
                data: report.filter(d => Number(d.rating) === -1).map(day_map),
            },
            {
                label: 'Unapproved',
                data: report.filter(d => Number(d.rating) === 0).map(day_map),
            },
        ]
    });

</script>

<div class="chart">
    <Bar data={{ datasets}}
    width={600}
    height={300}
    options={{
        responsive: true,
        // maintainAspectRatio: false,
        scales: {
            x: {
                type: 'time',
                time: {
                    unit: 'day',
                    displayFormats: {
                        day: 'MMM d'
                    }
                },
                adapters: { 
                    date: {
                    locale: enUS, 
                    },
                }, 
            },
            // y: {
            //     min: 0,
            //     max: 10,
            //     ticks: {
            //         stepSize: 1
            //     }
            // }
        }
    }}
    />
</div>

<style lang="less">
    
</style>