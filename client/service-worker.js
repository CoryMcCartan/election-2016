/**
 * Service Worker for offline use.
 */
var log = false;

var CACHE_VERSION = "v1.0";

var base = location.pathname.replace("service-worker.js", "");
var STATIC_CACHE = [
    base + "assets/flag.gif",
    base + "assets/usa.json",
    base + "js/lib/d3.v4.min.js",
    base + "js/lib/queue.v1.min.js",
    base + "js/lib/topojson.v0.min.js",
    base + "js/lib/lib.min.js",
    base + "js/states.js",
    "https://fonts.googleapis.com/css?family=Raleway:400,700",
    "https://fonts.googleapis.com/css?family=Roboto+Mono:300,700,400",
];
var DYNAMIC_CACHE = [
    base,
    base + "index.html",
    base + "president/index.html",
    base + "president/",
    base + "house/index.html",
    base + "house/",
    base + "manifest.json",
    base + "css/main.css",
    base + "js/president.js",
    base + "js/house.js",
    base + "js/main.js",
    base + "data/president-history.csv",
    base + "data/president-states.csv",
    base + "data/president-electors.csv",
    base + "data/house-history.csv",
    base + "data/house-districts.csv",
    base + "data/house-seats.csv",
];
var CACHE = STATIC_CACHE.concat(DYNAMIC_CACHE);

// say what we want cached
this.addEventListener("install", function(e) {
    e.waitUntil(
        caches.open(CACHE_VERSION)
        .then(function(cache) {
            return cache.addAll(CACHE); 
        })
    );
});

// route requests the right way
this.addEventListener("fetch", function(e) {
    var url = new URL(e.request.url);

    var has = function(arr, test) {
        var length = arr.length;
        for (var i = 0; i < length; i++) {
           if (arr[i] === test || 
                   (arr[i] === test.slice(1) && test !== "/") )
               return true; 
        }
        return false;
    };

    if (has(STATIC_CACHE, url.pathname)) { // prefer cached version
        if (log) console.log("STATIC: " + url.pathname);
        e.request.mode = "no-cors";
        e.respondWith(caches.match(e.request));
    } else if (has(DYNAMIC_CACHE, url.pathname)) { // prefer network version
        if (log) console.log("DYNAMIC: " + url.pathname);
        e.respondWith(
            fetch(e.request).then(function(resp) {
                return resp; 
            })
            .catch(function(r) {
                return caches.match(e.request);
            })
        );
    } else { // try cache, if not then get from network, then store in cache
        if (log) console.log("NEITHER: " + url.pathname);
        e.respondWith(
            caches.match(e.request)
            .then(function(response) {
                return response || fetch(e.request.clone())
                .then(function(r) {
                    return caches.open(CACHE_VERSION)
                    .then(function(cache) {
                        cache.put(e.request, r.clone());
                        return r;
                    })
                });
            })
        );
    }

});
