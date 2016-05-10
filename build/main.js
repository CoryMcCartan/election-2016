/*
 * JS LIBRARY
 * CORY McCARTAN
 * MARCH 2016
 */


(function() {
    "use strict";

    // call main()
    document.addEventListener("readystatechange", function() {
        if (document.readyState !== "complete") return;

        if (main.constructor.name === "GeneratorFunction") {
            runAsyncFunction(main);
        } else {
            main();
        }
    });

    // DOM getters
    window.$ = (s) => document.querySelector(s);
    window.$$ = (s) => document.querySelectorAll(s);

    // utility functions
    window.NULLF = () => {};
    window.LOGF = (l) => console.log(l);

    // yield for async/await stuff
    var runAsyncFunction = function(generator) {
        var iterator = generator();
        var result;

        var iterate = function(value) {
            result = iterator.next(value); 

            if (!result.done) {
                if ("then" in result.value) { // is a promise
                    result.value.then(iterate); // continue when done
                } else {
                    // continue immediately, avoiding synchronous recursion
                    setTimeout(iterate.bind(this, result.value), 0); 
                }
            }
        };
        
        iterate();
    };

    window.Mediator = function(glue) {
        var self = {};

        self.trigger = function(name, ...data) {   
            var functionName = "on" + name;

            if (glue.hasOwnProperty(functionName) 
                && typeof glue[functionName] === "function") {
                    glue[functionName](...data);
                }
        };

        return self;
    };
})();
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
        .domain([0, 0.5, 1])
        .range([RED, YELLOW, BLUE]);
        //.domain([0, 0.1, 0.5, 0.9, 1])
        //.range([RED, RED, YELLOW, BLUE, BLUE]);

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

                tName.innerHTML = state.id;

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
