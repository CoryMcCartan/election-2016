window.abbrFromState = {
    'Alabama': 'AL',
    'Alaska': 'AK',
    'American Samoa': 'AS',
    'Arizona': 'AZ',
    'Arkansas': 'AR',
    'California': 'CA',
    'Colorado': 'CO',
    'Connecticut': 'CT',
    'Delaware': 'DE',
    'District of Columbia': 'DC',
    'Federated States Of Micronesia': 'FM',
    'Florida': 'FL',
    'Georgia': 'GA',
    'Guam': 'GU',
    'Hawaii': 'HI',
    'Idaho': 'ID',
    'Illinois': 'IL',
    'Indiana': 'IN',
    'Iowa': 'IA',
    'Kansas': 'KS',
    'Kentucky': 'KY',
    'Louisiana': 'LA',
    'Maine': 'ME',
    'Marshall Islands': 'MH',
    'Maryland': 'MD',
    'Massachusetts': 'MA',
    'Michigan': 'MI',
    'Minnesota': 'MN',
    'Mississippi': 'MS',
    'Missouri': 'MO',
    'Montana': 'MT',
    'Nebraska': 'NE',
    'Nevada': 'NV',
    'New Hampshire': 'NH',
    'New Jersey': 'NJ',
    'New Mexico': 'NM',
    'New York': 'NY',
    'North Carolina': 'NC',
    'North Dakota': 'ND',
    'Northern Mariana Islands': 'MP',
    'Ohio': 'OH',
    'Oklahoma': 'OK',
    'Oregon': 'OR',
    'Palau': 'PW',
    'Pennsylvania': 'PA',
    'Puerto Rico': 'PR',
    'Rhode Island': 'RI',
    'South Carolina': 'SC',
    'South Dakota': 'SD',
    'Tennessee': 'TN',
    'Texas': 'TX',
    'Utah': 'UT',
    'Vermont': 'VT',
    'Virgin Islands': 'VI',
    'Virginia': 'VA',
    'Washington': 'WA',
    'West Virginia': 'WV',
    'Wisconsin': 'WI',
    'Wyoming': 'WY'
};

window.stateFromAbbr = {
    "AL": "Alabama",
    "AK": "Alaska",
    "AS": "American Samoa",
    "AZ": "Arizona",
    "AR": "Arkansas",
    "CA": "California",
    "CO": "Colorado",
    "CT": "Connecticut",
    "DE": "Delaware",
    "DC": "District of Columbia",
    "FM": "Federated States Of Micronesia",
    "FL": "Florida",
    "GA": "Georgia",
    "GU": "Guam",
    "HI": "Hawaii",
    "ID": "Idaho",
    "IL": "Illinois",
    "IN": "Indiana",
    "IA": "Iowa",
    "KS": "Kansas",
    "KY": "Kentucky",
    "LA": "Louisiana",
    "ME": "Maine",
    "MH": "Marshall Islands",
    "MD": "Maryland",
    "MA": "Massachusetts",
    "MI": "Michigan",
    "MN": "Minnesota",
    "MS": "Mississippi",
    "MO": "Missouri",
    "MT": "Montana",
    "NE": "Nebraska",
    "NV": "Nevada",
    "NH": "New Hampshire",
    "NJ": "New Jersey",
    "NM": "New Mexico",
    "NY": "New York",
    "NC": "North Carolina",
    "ND": "North Dakota",
    "MP": "Northern Mariana Islands",
    "OH": "Ohio",
    "OK": "Oklahoma",
    "OR": "Oregon",
    "PW": "Palau",
    "PA": "Pennsylvania",
    "PR": "Puerto Rico",
    "RI": "Rhode Island",
    "SC": "South Carolina",
    "SD": "South Dakota",
    "TN": "Tennessee",
    "TX": "Texas",
    "UT": "Utah",
    "VT": "Vermont",
    "VI": "Virgin Islands",
    "VA": "Virginia",
    "WA": "Washington",
    "WV": "West Virginia",
    "WI": "Wisconsin",
    "WY": "Wyoming"
};

window.electors = {
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


/*
 * 2016 ELECTION PREDICTIONS
 *
 * CORY McCARTAN
 */


"use strict";

const DEM = 0, GOP = 1;
const DEM_CANDIDATE = "Hillary Clinton";
const GOP_CANDIDATE = "Donald Trump";

const RED = "#e65";
const YELLOW = "#ee8";
const BLUE = "#59e";
const GREY = "#aaa";

function main() {
    d3.csv("data/overall.csv", d => ({
        candidate: d.party === "DEM" ? DEM_CANDIDATE : GOP_CANDIDATE,
        popularVote: +d.popular,
        electors: +d.electors,
        probability: +d.probability,
    }), (error, candidates) => {
        showOverall(candidates);
        makeMap(true);
        makeHistogram(candidates[DEM].electors);
    })
}

function showOverall(candidates) {
    let winner = candidates[DEM].electors > candidates[GOP].electors ? DEM : GOP;
    $("#demEV").innerHTML = candidates[DEM].electors.toFixed(0);
    $("#gopEV").innerHTML = candidates[GOP].electors.toFixed(0);
    let name = candidates[winner].candidate;
    let prob = (candidates[winner].probability * 100).toFixed(0)
    // figure out a/an
    let article = "a";
    if (prob[0] === "8" || prob === "11" || prob === "18")
        article += "n"; 
    $("#prediction").innerHTML = `${name} has ${article} ${prob}% chance of winning the election.`
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

    $("#toggleProbs").onclick = function() {
        showProbabilities = !showProbabilities;

        states.selectAll("path")
            .attr("fill", color.bind(null, data));
    };
}

function makeHistogram(most) {
    const chartRatio = 0.35;
    const margin = {L: 40, R: 5, B: 35};

    let el = $("#histogram");
    let width = el.getBoundingClientRect().width;
    let height = width * chartRatio;

    let x = d3.scale.ordinal()
        .domain(d3.range(538))
        .rangeBands([margin.L, width - margin.R], -0.25);
    let y = d3.scale.linear()
        .range([height, margin.B]);

    let ticks = innerWidth > 500 ? 30 : 54;

    let xAxis = d3.svg.axis()
        .scale(x)
        .tickValues(x.domain().filter((d, i) => !(i % ticks)))
        .orient("bottom");
    let yAxis = d3.svg.axis()
        .scale(y)
        .orient("left")
        .ticks(6, "%");

    let chart = d3.select(el).append("svg")
        .attr("width", width)
        .attr("height", height);

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
            .attr("class", "label")
            .attr("y", 25)
            .attr("x", width - 10)
            .attr("dy", ".71em")
            .style("font-weight", "bold")
            .style("text-anchor", "end")
            .text("Democratic Electors");

        chart.append("g")
            .attr("class", "y axis")
            .attr("transform", `translate(${margin.L}, ${-margin.B})`)
            .call(yAxis)
        .append("text")
            .attr("class", "label")
            .attr("transform", "rotate(-90)")
            .attr("y", 6)
            .attr("x", -35)
            .attr("dy", ".71em")
            .style("font-weight", "bold")
            .style("text-anchor", "end")
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
            .attr("y", d => y(d.percentage) - margin.B)
            .attr("height", d => height - y(d.percentage))
            .on("mouseover", function(state, index) {
                this.style.opacity = 0.5;
            })
            .on("mouseout", function() {
                this.style.opacity = 1.0;
            });

        el.style.opacity = 1.0;
    });

    d3.select(window).on("resize.hist", () => {
        width = el.getBoundingClientRect().width;
        height = width * chartRatio;

        x.rangeBands([margin.L, width - margin.R], -0.25);
        y.range([height, margin.B]);

        let ticks = innerWidth > 500 ? 30 : 54;
        xAxis.tickValues(x.domain().filter((d, i) => !(i % ticks)))

        chart.attr("width", width);
        chart.attr("height", height);

        chart.select(".x.axis")
            .attr("transform", `translate(0, ${height - margin.B})`)
            .call(xAxis)
            .select(".label")
            .attr("x", width - 10);
        chart.select(".y.axis")
            .attr("transform", `translate(${margin.L}, ${-margin.B})`)
            .call(yAxis)
            
        chart.selectAll(".bar")
            .attr("x", d => x(d.electors))
            .attr("width", x.rangeBand())
            .attr("y", d => y(d.percentage) - margin.B)
            .attr("height", d => height - y(d.percentage));

    });
}

function sortByKey(arr, key) {
    return arr.sort((a, b) => {
        let x = a[key];
        let y = b[key];

        return (x < y) ? -1 : (x > y) ? 1 : 0;
    });
}

