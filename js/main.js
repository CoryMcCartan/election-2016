if (navigator.serviceWorker) {
    navigator.serviceWorker.register("service-worker.js", {
        scope: location.pathname.replace("index.html", "")
    }).then(() => {
        console.log("Service Worker Registered.");
    })
}
