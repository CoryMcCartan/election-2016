/*
 * 2016 ELECTION PREDICTIONS
 *
 * CORY McCARTAN
 */

"use strict";

function main() {
    makeMap(true);
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

    let colorScale = d3.scale.linear()
        .domain([0, 0.5, 1])
        .range([RED, YELLOW, BLUE]);

    let color = (data, state) => {
        let info = data.find(s => s.state === state.id);
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

    let drawMap = function(error, geo, data) {
        if (error) throw error;

        states.selectAll("path")
            .data(topojson.object(geo, geo.objects.states).geometries)
            .enter().append("path")
                .attr("fill", color.bind(null, data))
                .attr("d", path);

        map.append("path")
            .datum(topojson.mesh(geo, geo.objects.states, (a, b) => a !== b))
            .attr("class", "borders")
            .attr("fill", "none")
            .attr("stroke", "#fff")
            .attr("d", path);
    };

    queue()
        .defer(d3.json, "assets/usa_detailed.json")
        .defer(d3.csv, "data/prob.csv", d => ({ 
            state: d.state, 
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
}
