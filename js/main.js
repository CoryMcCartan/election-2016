const DEM = 0, GOP = 1;
const DEM_SEATS = 186;

function main() {
    d3.csv("/election-2016/data/president-history.csv?" + Math.random(), d => ({
        avgElectors: +d.avgElectors,
        calledElectors: +d.calledElectors,
        prob: +d.probability,
    }), (error, history) => {
        let current = history[0];

        let winner = current.avgElectors > 270 ? DEM : GOP;
        $("#prob-dem-pres").innerHTML = Math.round(current.prob * 100).toFixed(0) + "%";
        $("#prob-gop-pres").innerHTML = Math.round(100 - current.prob * 100).toFixed(0) + "%";
        $("#bar-pres > .dem").style.width = (current.prob * 100).toFixed(1) + "%";
        $("#bar-pres > .gop").style.width = (100 - current.prob * 100).toFixed(1) + "%";
    });

    d3.csv("/election-2016/data/house-history.csv?" + Math.random(), d => ({
        mean: +d.mean,
        mode: +d.mode,
        prob: +d.probability,
    }), (error, history) => {
        let current = history[0];

        let seats = current.mean + DEM_SEATS;
        let winner = seats > 218 ? DEM : GOP;
        $("#prob-dem-house").innerHTML = Math.round(current.prob * 100).toFixed(0) + "%"
        $("#prob-gop-house").innerHTML = Math.round(100 - current.prob * 100).toFixed(0) + "%"
        $("#bar-house > .dem").style.width = (current.prob * 100).toFixed(1) + "%";
        $("#bar-house > .gop").style.width = (100 - current.prob * 100).toFixed(1) + "%";
        if (smallScreen()) {
            $("#bar-house > .dem > .name").innerHTML = "DEM";
            $("#bar-house > .gop > .name").innerHTML = "GOP";
        }
        
    });
}

if (navigator.serviceWorker) {
    navigator.serviceWorker.register("service-worker.js", {
        scope: location.pathname.replace("index.html", "")
    }).then(() => {
        console.log("Service Worker Registered.");
    })
}

function smallScreen() {
    return window.innerWidth < 600;
}
