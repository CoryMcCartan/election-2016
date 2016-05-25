/**
 * Service Worker for offline use.
 */
var CACHE_VERSION = "v1";
var base = location.pathname.replace("service-worker.js", "");
var STATIC_CACHE = [
    base + "assets/flag.gif",
    base + "assets/usa.json",
    base + "build/lib/all_libs.js",
    "https://fonts.googleapis.com/css?family=Raleway:400,700",
    "https://fonts.googleapis.com/css?family=Roboto+Mono:300,700,400",
];
var DYNAMIC_CACHE = [
    base,
    base + "index.html",
    base + "manifest.json",
    base + "build/main.css",
    base + "build/main.js",
    base + "data/history.csv",
    base + "data/states.csv",
    base + "data/electors.csv",
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
        console.log("STATIC: " + url.pathname);
        e.request.mode = "no-cors";
        e.respondWith(caches.match(e.request));
    } else if (has(DYNAMIC_CACHE, url.pathname)) { // prefer network version
        console.log("DYNAMIC: " + url.pathname);
        e.respondWith(
            fetch(e.request)
            .catch(function(r) {
                return caches.match(e.request);
            })
        );
    } else { // try cache, if not then get from network, then store in cache
        console.log("NEITHER: " + url.pathname);
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
