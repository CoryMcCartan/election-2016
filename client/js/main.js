//= require lib/lib.min
//= require states


/*
 * 2016 ELECTION PREDICTIONS
 *
 * CORY McCARTAN
 */

"use strict";

const DEM = 0, GOP = 1;
const DEM_CANDIDATE = "Hillary Clinton";
const GOP_CANDIDATE = "Donald Trump";

function main() {
    makeMap(true);

    d3.csv("data/overall.csv", d => ({
        candidate: d.party === "DEM" ? DEM_CANDIDATE : GOP_CANDIDATE,
        popularVote: +d.popular,
        electors: +d.electors,
        probability: +d.probability,
    }), (error, candidates) => {
        showOverall(candidates);
    })
}

function showOverall(candidates) {
    let winner = candidates[DEM].electors > candidates[GOP].electors ? DEM : GOP;
    $("#demEV").innerHTML = candidates[DEM].electors.toFixed(0);
    $("#gopEV").innerHTML = candidates[GOP].electors.toFixed(0);
    $("#winner").innerHTML = candidates[winner].candidate;
    $("#prob").innerHTML = (candidates[winner].probability * 100).toFixed(0);
}

function makeMap(showProbabilities = true) {
    const RED = "#d54";
    const YELLOW = "#ee8";
    const BLUE = "#47d";
    const GREY = "#aaa";
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
        .attr("height", height)

    let path = d3.geo.path().projection(projection);

    let tooltip = d3.select(".tooltip")
    let tName = $("#t-name");
    let tDEM = $("#t-dem");
    let tGOP = $("#t-gop");

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

        states.selectAll("path")
            .data(geoObject)
            .enter().append("path")
                .attr("fill", color.bind(null, data))
                .attr("d", path)
                .attr("class", "state")
            .on("mouseover", function(state, index) {
                tooltip
                    .style("opacity", 1.0)
                    .style("left", d3.event.pageX - 70 + "px")
                    .style("top", d3.event.pageY + 30 + "px");

                let stateElectors = electors[ abbrFromState[state.id] ];
                tName.innerHTML = `${state.id} (${stateElectors})`;

                let probability = data[index].probability;
                tDEM.innerHTML = (probability * 100).toFixed(0) + "%";
                tGOP.innerHTML = (100 - probability * 100).toFixed(0) + "%";

                if (probability > 0.5) {
                    tDEM.parentElement.style.fontWeight = "bold";
                    tGOP.parentElement.style.fontWeight = "normal";
                } else {
                    tGOP.parentElement.style.fontWeight = "bold";
                    tDEM.parentElement.style.fontWeight = "normal";
                }

                this.style.opacity = 0.75;
            })
            .on("mousemove", function() {
                tooltip
                    .style("left", d3.event.pageX - 70 + "px")
                    .style("top", d3.event.pageY + 30 + "px");
            })
            .on("mouseout", function() {
                tooltip.style("opacity", 0.0)
                this.style.opacity = 1.0;
            });

        map.append("path")
            .datum(topojson.mesh(geo, geo.objects.states, (a, b) => a !== b))
            .attr("class", "borders")
            .attr("fill", "none")
            .attr("stroke", "#fff")
            .attr("d", path);

        el.style.opacity = 1;
    };

    queue()
        .defer(d3.json, "assets/usa_detailed.json")
        .defer(d3.csv, "data/prob.csv", d => ({ 
            state: stateFromAbbr[d.state], 
            probability: +d.probability 
        }))
        .await(drawMap);

    d3.select(window).on("resize", () => {
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

    $("#toggleProbs").onclick = function() {
        showProbabilities = !showProbabilities;

        states.selectAll("path")
            .attr("fill", color.bind(null, data));
    };
}

function sortByKey(arr, key) {
    return arr.sort((a, b) => {
        let x = a[key];
        let y = b[key];

        return (x < y) ? -1 : (x > y) ? 1 : 0;
    });
}

const electors = {
    AL: 9,
    AK: 3,
    AZ: 11,
    AR: 6,
    CA: 55,
    CO: 9,
    CT: 7,
    DC: 3,
    DE: 3,
    FL: 29,
    GA: 16,
    HI: 4,
    ID: 4,
    IL: 20,
    IN: 11,
    IA: 6,
    KS: 6,
    KY: 8,
    LA: 8,
    ME: 4,
    MD: 10,
    MA: 11,
    MI: 16,
    MN: 10,
    MS: 6,
    MO: 10,
    MT: 3,
    NE: 5,
    NV: 6,
    NH: 4,
    NJ: 14,
    NM: 5,
    NY: 29,
    NC: 15,
    ND: 3,
    OH: 18,
    OK: 7,
    OR: 7,
    PA: 20,
    RI: 4,
    SC: 9,
    SD: 3,
    TN: 11,
    TX: 38,
    UT: 6,
    VT: 3,
    VA: 13,
    WA: 12,
    WV: 5,
    WI: 10,
    WY: 3
};
