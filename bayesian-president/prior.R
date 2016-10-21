# 2016 PRESIDENTIAL ELECTION PREDICTIONS
# © 2016 Cory McCartan

getPriors = function() {
    d2004 = read.csv("data/elections/2004.csv")
    d2008 = read.csv("data/elections/2008.csv")
    d2012 = read.csv("data/elections/2012.csv")
    # Weighted average of proportion in each state
    mean_dem = (d2004$dem/d2004$total) * (3/6) +
        (d2008$dem/d2008$total) * (2/6) +
        (d2012$dem/d2012$total) * (1/6)
    mean_gop = (d2004$gop/d2004$total) * (3/6) +
        (d2008$gop/d2008$total) * (2/6) +
        (d2012$gop/d2012$total) * (1/6)

    return(data.frame(row.names=d2004$state, dem=mean_dem, gop=mean_gop))
}
