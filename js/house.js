/*
 * 2016 ELECTION PREDICTIONS
 *
 * CORY McCARTAN
 */

"use strict";

const DEM = 0, GOP = 1;
 
const RED = "#f66660";
const LIGHT_RED = "#fff0e7";
const YELLOW = "#ee5";
const LIGHT_BLUE = "#e7eeff";
const BLUE = "#6a80ff";
const GREY = "#aaa";

function main() {
    d3.csv("/election-2016/data/house-history.csv?" + Math.random(), d => ({
        date: new Date(+d.date),
        mean: +d.mean,
        mode: +d.mode,
        prob: +d.probability,
        iterations: +d.iterations,
        demPop: +d.demPopWins,
        gopPop: +d.gopPopWins,
        demMismatch: +d.demMismatch,
        gopMismatch: +d.gopMismatch,
        demLandslide: +d.demLandslide,
        gopLandslide: +d.gopLandslide,
    }), (error, history) => {
        showOverall(history);
        makeHistogram(history[0]);
        makeHistoryLine(history);
    });
}

function showOverall(history, prediction = false) {
    let current = history[0];

    let seats = current.mean;
    let winner = seats > 218 ? DEM : GOP;
    $("#demEV").innerHTML = Math.round(current.prob * 100).toFixed(0) + "%"
    $("#gopEV").innerHTML = Math.round(100 - current.prob * 100).toFixed(0) + "%"
    let name = winner === DEM ? "Democrats" : "Republicans";
    // because DEM = 0 and GOP = 1, this will invert the probability (which is by
    // default in terms of the Democrats) if the GOP is favored.
    let prob = Math.round(Math.abs(winner - current.prob) * 100).toFixed(0);

    $("time").innerHTML = `Last Updated ${current.date.toLocaleString()}.`;
    // figure out a/an
    let article = "a";
    if (prob[0] === "8" || prob === "11" || prob === "18")
        article += "n"; 
    $("#prediction").innerHTML = `The ${name} have ${article} ${prob}% chance of controlling the House.`

    let oneDay = 24 * 60 * 60 * 1000;
    let last = history.find(e => current.date - e.date > oneDay);
    if (last) { // if the model is at least one day old
        // change since yesterday
        let delta = (current.prob - last.prob) * 100;

        $("#prediction").innerHTML += 
            `<br />This is ${delta >= 0 ? "an increase" : "a decrease"} of 
            ${Math.abs(delta).toFixed(1)}% from yesterday.`
    }

    let demSeats = seats.toFixed(0);
    let gopSeats = (435 - seats).toFixed(0);
    $("#prediction").innerHTML += `<br />The Democrats are expected to have ${demSeats} ` +
        `seats to the Republican’s ${gopSeats}.`

    // scenarios
    $("td#scn-dem-pop").innerHTML = (100 * current.demPop).toFixed(1) + "%";
    $("td#scn-gop-pop").innerHTML = (100 * current.gopPop).toFixed(1) + "%";
    $("td#scn-dem-mismatch").innerHTML = (100 * current.demMismatch).toFixed(1) + "%";
    $("td#scn-gop-mismatch").innerHTML = (100 * current.gopMismatch).toFixed(1) + "%";
    $("td#scn-dem-landslide").innerHTML = (100 * current.demLandslide).toFixed(1) + "%";
    $("td#scn-gop-landslide").innerHTML = (100 * current.gopLandslide).toFixed(1) + "%";
}

function makeHistogram(stats) {
    const chartRatio = 0.3;
    const margin = {L: 40, R: 5, B: 35, T: 15};

    let el = $("#histogram");
    let width = el.getBoundingClientRect().width;
    let height = width * chartRatio;

    let x = d3.scale.ordinal();
    let y = d3.scale.linear();
    let xAxis = d3.svg.axis();
    let yAxis = d3.svg.axis();
    let chart = d3.select(el).append("svg");

    let tooltip = $("#hist-tooltip");
    let tSeats = $("#ht-seats");
    let tPercent = $("#ht-percent");

    let modeLabel, meanLabel;

    d3.csv("/election-2016/data/house-seats.csv?" + Math.random(), d => ({
        seats: +d.seats,
        prob: +d.prob,
    }), (error, data) => {
        if (error) throw error;

        let minSeats = data.findIndex(d => d.prob > 0);
        let maxSeats = stats.mode + data.slice(stats.mode).findIndex(d => d.prob == 0);
        data = data.slice(minSeats, maxSeats);
        let most = d3.max(data, d => d.prob)

        x
            .domain(d3.range(minSeats - 2, maxSeats + 8))
            .rangeBands([margin.L, width - margin.R], smallScreen() ? -0.1 : -0.06);
        y
            .domain([0, most]) 
            .range([height - margin.B, margin.T]);

        let ticks = smallScreen() ? 54 : 30;

        xAxis
            .scale(x)
            .tickValues(x.domain().filter((d, i) => !(i % ticks)))
            .orient("bottom");
        yAxis
            .scale(y)
            .orient("left")
            .ticks(smallScreen() ? 4 : 6, "%");

        chart
            .attr("width", width)
            .attr("height", height);

        chart.append("g")
            .attr("class", "x axis")
            .attr("transform", `translate(0, ${height - margin.B})`)
            .call(xAxis)
        .append("text")
            .attr("class", "x label")
            .attr("y", 25)
            .attr("x", width - 10)
            .text("Democratic Seats");

        chart.append("g")
            .attr("class", "y axis")
            .attr("transform", `translate(${margin.L}, 0)`)
            .call(yAxis)
        .append("text")
            .attr("class", "y label")
            .attr("y", 6)
            .attr("x", -5)
            .text("Frequency");

        chart.selectAll(".bar")
            .data(data)
        .enter().append("rect")
            .attr("class", "bar")
            .attr("fill", d => {
                if (Math.abs(d.seats - stats.mean) < 0.5) return YELLOW;
                else if (d.seats === stats.mode) return YELLOW;
                else if (d.seats >= 218) return BLUE;
                else return RED;
            })
            .attr("x", d => x(d.seats))
            .attr("width", x.rangeBand())
            .attr("y", d => y(d.prob))
            .attr("height", d => height - y(d.prob) - margin.B);

        let y0 = y(0);
        modeLabel = chart.append("g")
            .attr("transform", `translate(${x(stats.mode)}, ${y0})`);
        modeLabel.append("text")
            .attr("class", "hist-label")
            .text("Mode");

        meanLabel = chart.append("g")
            .attr("transform", `translate(${x(Math.round(stats.mean))}, ${y0})`);
        meanLabel.append("text")
            .attr("class", "hist-label")
            .text("Mean");

        let usingTooltip = false;
        chart
            .on("mouseover", function() {
                let el = d3.event.target;
                if (el.classList[0] !== "bar") return;

                el.style.opacity = 0.5;
                tooltip.style.opacity = 1.0;
                tSeats.innerHTML = el.__data__.seats;
                tPercent.innerHTML = (100 * el.__data__.prob).toFixed(2) + "%";
            })
            .on("mouseout", function() {
                let el = d3.event.target;
                if (el.classList[0] !== "bar") return;

                el.style.opacity = 1.0;
                tooltip.style.opacity = 0.0;
            });

        el.style.opacity = 1.0;
    });

    d3.select(window).on("resize.hist", () => {
        width = el.getBoundingClientRect().width;
        height = width * chartRatio;

        x.rangeBands([margin.L, width - margin.R], smallScreen() ? -0.5 : -0.2);
        y.range([height - margin.B, margin.T]);


        let ticks = smallScreen() ? 54 : 30;
        xAxis.tickValues(x.domain().filter((d, i) => !(i % ticks)))
        yAxis.ticks(smallScreen() ? 4 : 6, "%");

        chart.attr("width", width);
        chart.attr("height", height);

        chart.select(".x.axis")
            .attr("transform", `translate(0, ${height - margin.B})`)
            .call(xAxis)
            .select(".label")
            .attr("x", width - 10);
        chart.select(".y.axis")
            .call(yAxis);
            
        chart.selectAll(".bar")
            .attr("x", d => x(d.seats))
            .attr("width", x.rangeBand())
            .attr("y", d => y(d.prob))
            .attr("height", d => height - y(d.prob) - margin.B);
        
        let y0 = y(0);
        modeLabel.attr("transform", `translate(${x(stats.mode)}, ${y0})`);
        meanLabel.attr("transform", `translate(${x(Math.round(stats.mean))}, ${y0})`);
    });
}

function makeHistoryLine(history) {
    const chartRatio = 0.5;
    const margin = {L: 40, R: 40, B: 35, T: 15};

    let startDate = history[history.length - 1].date;
    let endDate = history[0].date;

    let el = $("#history");
    let width = el.getBoundingClientRect().width;
    let height = width * chartRatio;

    let x = d3.time.scale()
        .domain([startDate, endDate])
        .range([margin.L, width - margin.R]);
    let y = d3.scale.linear()
        .domain([0, 1])
        .range([height - margin.B, margin.T]);

    let xAxis = d3.svg.axis()
        .scale(x)
        .orient("bottom")
        .ticks(smallScreen() ? 4 : 7);
    let yAxis = d3.svg.axis()
        .scale(y)
        .orient("left")
        .ticks(smallScreen() ? 5 : 10, "%");

    let demLine = d3.svg.line()
        .x(d => x(d.date))
        .y(d => y(d.prob));

    let gopLine = d3.svg.line()
        .x(d => x(d.date))
        .y(d => y(1 - d.prob));

    let chart = d3.select(el).append("svg")
        .attr("width", width)
        .attr("height", height);

    // axes
    chart.append("g")
        .attr("class", "x axis")
        .attr("transform", `translate(0, ${height - margin.B})`)
        .call(xAxis)
    .append("text")
        .attr("class", "x label")
        .attr("y", 25)
        .attr("x", width - 50)
        .text("Date");

    chart.append("g")
        .attr("class", "y axis")
        .attr("transform", `translate(${margin.L}, 0)`)
        .call(yAxis)
    .append("text")
        .attr("class", "y label")
        .attr("y", 6)
        .attr("x", -5)
        .text("Probability");

    // labels
    let prob = history[0].prob;
    let demEndLabel = chart.append("text")
        .attr("class", "dem end-label")
        .attr("x", width - 30)
        .attr("y", y(prob) + 5)
        .text((100 * prob).toFixed(0) + "%");
    let gopEndLabel = chart.append("text")
        .attr("class", "gop end-label")
        .attr("x", width - 30)
        .attr("y", y(1 - prob) + 5)
        .text((100 - 100 * prob).toFixed(0) + "%");

    let demCircle = chart.append("circle")
        .attr("class", "dem end-circle")
        .attr("cx", x(endDate))
        .attr("cy", y(prob))
        .attr("r", 3);
    let gopCircle = chart.append("circle")
        .attr("class", "gop end-circle")
        .attr("cx", x(endDate))
        .attr("cy", y(1 - prob))
        .attr("r", 3);

    chart.append("path")
        .datum(history)
        .attr("id", "demProbLine")
        .attr("d", demLine)
        .attr("stroke", BLUE)
        .attr("stroke-width", 2)
        .attr("fill", "transparent");

    chart.append("path")
        .datum(history)
        .attr("d", gopLine)
        .attr("id", "gopProbLine")
        .attr("stroke", RED)
        .attr("stroke-width", 2)
        .attr("fill", "transparent");

    chart
        .on("mousemove", function() {
            let e_x = d3.mouse(this)[0];
            let date = x.invert(e_x);
            let i = history.findIndex(d => d.date < date) - 1;
            let prob;
            if (i < 0 || i >= history.length - 1) {
                prob = history[0].prob;
                e_x = x(endDate);
            } else {
                let gap = history[i].date - history[i+1].date;
                let weight = (date - history[i+1].date) / gap;
                prob = weight * history[i].prob + (1-weight) * history[i+1].prob;
            }

            demCircle
                .attr("cx", e_x)
                .attr("cy", y(prob));
            gopCircle
                .attr("cx", e_x)
                .attr("cy", y(1 - prob));

            demEndLabel.text((100 * prob).toFixed(0) + "%");
            gopEndLabel.text((100 - 100 * prob).toFixed(0) + "%");
        })
        .on("mouseout", function() {
            demCircle
                .attr("cx", x(endDate))
                .attr("cy", y(prob));
            gopCircle
                .attr("cx", x(endDate))
                .attr("cy", y(1 - prob));

            demEndLabel.text((100 * prob).toFixed(0) + "%");
            gopEndLabel.text((100 - 100 * prob).toFixed(0) + "%");
        });

    el.style.opacity = 1.0;

    d3.select(window).on("resize.line", () => {
        let width = el.getBoundingClientRect().width;
        let height = width * chartRatio;

        chart
            .attr("width", width)
            .attr("height", height);

        x.range([margin.L, width - margin.R]);
        y.range([height - margin.B, margin.T]);

        xAxis.ticks(smallScreen() ? 4 : 7);
        yAxis.ticks(smallScreen() ? 5 : 10, "%");

        chart.select(".x.axis")
            .attr("transform", `translate(0, ${height - margin.B})`)
            .call(xAxis)
            .select(".label")
            .attr("x", width - 50);
        chart.select(".y.axis")
            .call(yAxis);

        demEndLabel
            .attr("x", width - 30)
            .attr("y", y(prob) + 5);
        gopEndLabel
            .attr("x", width - 30)
            .attr("y", y(1 - prob) + 5);

        demCircle
            .attr("cx", x(endDate))
            .attr("cy", y(prob));
        gopCircle
            .attr("cx", x(endDate))
            .attr("cy", y(1 - prob));
            
            

        chart.select("#demProbLine")
            .attr("d", demLine);
        chart.select("#gopProbLine")
            .attr("d", gopLine);
    });
}

function sortByKey(arr, key) {
    return arr.sort((a, b) => {
        let x = a[key];
        let y = b[key];

        return (x < y) ? -1 : (x > y) ? 1 : 0;
    });
}

function smallScreen() {
    return window.innerWidth < 600;
}
