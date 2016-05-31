//= require states

/*
 * 2016 ELECTION PREDICTIONS
 *
 * CORY McCARTAN
 */

"use strict";

const DEM = 0, GOP = 1;
const CANDIDATES = ["Hillary Clinton", "Donald Trump"];

const RED = "#e65";
const YELLOW = "#ee8";
const BLUE = "#59e";
const GREY = "#aaa";

function main() {
    d3.csv("data/history.csv", d => ({
        date: new Date(+d.date),
        avgElectors: +d.avgElectors,
        calledElectors: +d.calledElectors,
        probability: +d.probability,
        iterations: +d.iterations,
        recount: +d.recounts,
        tie: +d.ties,
        demPopEC: +d.demWinPopLoseEC,
        gopPopEC: +d.gopWinPopLoseEC,
        demLandslide: +d.demLandslide,
        gopLandslide: +d.gopLandslide,
    }), (error, history) => {
        let expected = showOverall(history);
        makeMap();
        makeHistogram(expected);
        makeHistoryLine(history);
    });
}

function showOverall(history, prediction = false) {
    let current = history[0];

    let electors = prediction ? current.calledElectors : current.avgElectors;
    let winner = electors > 270 ? DEM : GOP;
    $("#demEV").innerHTML = electors.toFixed(0);
    $("#gopEV").innerHTML = (538 - electors).toFixed(0);
    let name = CANDIDATES[winner];
    // because DEM = 0 and GOP = 1, this will invert the probability (which is by
    // default in terms of the Democrats) if the GOP is favored.
    let prob = (Math.abs(winner - current.probability) * 100).toFixed(0)

    $("time").innerHTML = `Last Updated ${current.date.toLocaleString()}.`;

    // figure out a/an
    let article = "a";
    if (prob[0] === "8" || prob === "11" || prob === "18")
        article += "n"; 
    $("#prediction").innerHTML = `${name} has ${article} ${prob}% chance of winning the election.`

    let oneDay = 24 * 60 * 60 * 1000;
    let last = history.find(e => current.date - e.date > oneDay);
    if (last) { // if the model is at least one day old
        // change since yesterday
        let delta = (prob - Math.abs(winner - last.probability) * 100).toFixed(0)

        $("#prediction").innerHTML += 
            `<br /> This is ${delta >= 0 ? "an increase" : "a decrease"} of 
            ${Math.abs(delta).toFixed(0)}% from yesterday.`
    }

    $("#showProbs").addEventListener("click", function() {
        $("#demEV").innerHTML = current.avgElectors.toFixed(0);
        $("#gopEV").innerHTML = (538 - current.avgElectors).toFixed(0);

        this.hidden = true;
        $("#callStates").hidden = false;
    });
    $("#callStates").addEventListener("click", function() {
        $("#demEV").innerHTML = current.calledElectors.toFixed(0);
        $("#gopEV").innerHTML = (538 - current.calledElectors).toFixed(0);

        this.hidden = true;
        $("#showProbs").hidden = false;
    });

    // scenarios
    $("td#scn-tie").innerHTML = (100 * current.tie).toFixed(1) + "%";
    $("td#scn-recount").innerHTML = (100 * current.recount).toFixed(1) + "%";
    $("td#scn-dem-pop-ec").innerHTML = (100 * current.demPopEC).toFixed(1) + "%";
    $("td#scn-gop-pop-ec").innerHTML = (100 * current.gopPopEC).toFixed(1) + "%";
    $("td#scn-dem-landslide").innerHTML = (100 * current.demLandslide).toFixed(1) + "%";
    $("td#scn-gop-landslide").innerHTML = (100 * current.gopLandslide).toFixed(1) + "%";

    return electors;
}

function makeMap(showProbabilities = true) {
    const mapRatio = 0.6;
    const paddingRatio = 1.2;

    let el = $("#map");
    let width = el.getBoundingClientRect().width;
    let height = width * mapRatio;

    let projection = d3.geo.albersUsa()
        .scale(paddingRatio * width)
        .translate([width/2, height/2]);

    let map = d3.select(el).append("svg")
        .attr("width", width)
        .attr("height", height);

    let path = d3.geo.path().projection(projection);

    let tooltip = d3.select("#map-tooltip");
    let tName = $("#mt-name");
    let tDEM = $("#mt-dem");
    let tGOP = $("#mt-gop");

    let colorScale = d3.scale.linear()
        //.domain([0, 0.5, 1])
        //.range([RED, YELLOW, BLUE]);
        .domain([0, 0.1, 0.5, 0.9, 1])
        .range([RED, RED, YELLOW, BLUE, BLUE]);

    let color = (data, state, index) => {
        let info = data[index];
        if (!info) return GREY;

        if (showProbabilities) {
            return colorScale(info.probability);
        } else {
            if (info.probability > 0.5)
                return BLUE;
            else
                return RED;
        }
    };

    var states = map.append("g");

    let data;
    let drawMap = function(error, geo, _data) {
        if (error) throw error;

        data = _data;
        sortByKey(data, "state");

        let geoObject = topojson.object(geo, geo.objects.states).geometries;
        sortByKey(geoObject, "id");
        // add the state's index to its data
        geoObject = geoObject.map((d, i) => { 
            d.index = i; 
            return d;
        }); 

        states.selectAll("path")
            .data(geoObject)
            .enter().append("path")
                .attr("fill", color.bind(null, data))
                .attr("d", path)
                .attr("class", "state");
        map
            .on("mouseover", function() {
                let el = d3.event.target;
                if (el.classList[0] !== "state") return;

                tooltip
                    .style("opacity", 1.0)
                    .style("left", d3.event.pageX - 70 + "px")
                    .style("top", d3.event.pageY + 30 + "px");

                let id = el.__data__.id;
                let stateElectors = electors[ abbrFromState[id] ];
                tName.innerHTML = `${id} (${stateElectors})`;

                let probability = data[el.__data__.index].probability;
                tDEM.innerHTML = (probability * 100).toFixed(0) + "%";
                tGOP.innerHTML = (100 - probability * 100).toFixed(0) + "%";

                if (probability > 0.5) {
                    tDEM.parentElement.style.fontWeight = "bold";
                    tGOP.parentElement.style.fontWeight = "normal";
                } else {
                    tGOP.parentElement.style.fontWeight = "bold";
                    tDEM.parentElement.style.fontWeight = "normal";
                }

                el.style.opacity = 0.75;
            })
            .on("mousemove", function() {
                if (d3.event.target.classList[0] !== "state") return;

                tooltip
                    .style("left", d3.event.pageX - 70 + "px")
                    .style("top", d3.event.pageY + 30 + "px");
            })
            .on("mouseout", function() {
                let el = d3.event.target;
                if (el.classList[0] !== "state") return;

                tooltip.style("opacity", 0.0);
                el.style.opacity = 1.0;
            });

        map.append("path")
            .datum(topojson.mesh(geo, geo.objects.states, (a, b) => a !== b))
            .attr("class", "borders")
            .attr("fill", "none")
            .attr("d", path);

        el.style.opacity = 1;
    };

    queue()
        .defer(d3.json, "assets/usa.json")
        .defer(d3.csv, "data/states.csv", d => ({ 
            state: stateFromAbbr[d.state], 
            probability: +d.probability 
        }))
        .await(drawMap);

    d3.select(window).on("resize.map", () => {
        let width = el.getBoundingClientRect().width;
        let height = width * mapRatio;

        projection
            .scale(paddingRatio * width)
            .translate([width/2, height/2]);

        map.attr("width", width);
        map.attr("height", height);

        states.selectAll("path")
            .attr("d", path);

        map.selectAll(".borders")
            .attr("d", path);
    });

    
    $("#showProbs").addEventListener("click", function() {
        showProbabilities = true;

        states.selectAll("path")
            .attr("fill", color.bind(null, data));
    });
    $("#callStates").addEventListener("click", function() {
        showProbabilities = false;

        states.selectAll("path")
            .attr("fill", color.bind(null, data));
    });
}

function makeHistogram(most) {
    const chartRatio = 0.35;
    const margin = {L: 40, R: 5, B: 35, T: 15};

    let el = $("#histogram");
    let width = el.getBoundingClientRect().width;
    let height = width * chartRatio;

    let x = d3.scale.ordinal()
        .domain(d3.range(538))
        .rangeBands([margin.L, width - margin.R], -0.25);
    let y = d3.scale.linear()
        .range([height - margin.B, margin.T]);

    let ticks = smallScreen() ? 54 : 30;

    let xAxis = d3.svg.axis()
        .scale(x)
        .tickValues(x.domain().filter((d, i) => !(i % ticks)))
        .orient("bottom");
    let yAxis = d3.svg.axis()
        .scale(y)
        .orient("left")
        .ticks(smallScreen() ? 4 : 6, "%");

    let chart = d3.select(el).append("svg")
        .attr("width", width)
        .attr("height", height);

    let tooltip = $("#hist-tooltip");
    let tElectors = $("#ht-electors");
    let tPercent = $("#ht-percent");

    d3.csv("data/electors.csv", d => ({
        electors: +d.electors,
        percentage: +d.percentage,
    }), (error, data) => {
        if (error) throw error;

        let mode = d3.max(data, d => d.percentage)
        y.domain([0, mode]); // get max percentage

        chart.append("g")
            .attr("class", "x axis")
            .attr("transform", `translate(0, ${height - margin.B})`)
            .call(xAxis)
        .append("text")
            .attr("class", "x label")
            .attr("y", 25)
            .attr("x", width - 10)
            .text("Democratic Electors");

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
                if (Math.abs(d.electors - most) < 0.5) return YELLOW;
                else if (d.electors >= 270) return BLUE;
                else return RED;
            })
            .attr("x", d => x(d.electors))
            .attr("width", x.rangeBand())
            .attr("y", d => y(d.percentage))
            .attr("height", d => height - y(d.percentage) - margin.B);

        let usingTooltip = false;
        chart
            .on("mouseover", function() {
                let el = d3.event.target;
                if (el.classList[0] !== "bar") return;

                el.style.opacity = 0.5;
                tooltip.style.opacity = 1.0;
                tElectors.innerHTML = el.__data__.electors;
                tPercent.innerHTML = (100 * el.__data__.percentage).toFixed(2) + "%";
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

        x.rangeBands([margin.L, width - margin.R], -0.25);
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
            .attr("x", d => x(d.electors))
            .attr("width", x.rangeBand())
            .attr("y", d => y(d.percentage))
            .attr("height", d => height - y(d.percentage) - margin.B);

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
        .y(d => y(d.probability));

    let gopLine = d3.svg.line()
        .x(d => x(d.date))
        .y(d => y(1 - d.probability));

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
    let prob = history[0].probability;
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

if (navigator.serviceWorker) {
    navigator.serviceWorker.register("service-worker.js", {
        scope: location.pathname.replace("index.html", "")
    }).then(() => {
        console.log("Service Worker Registered.");
    })
}