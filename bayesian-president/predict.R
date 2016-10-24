#!/usr/local/bin/Rscript
# 2016 PRESIDENTIAL ELECTION PREDICTIONS
# © 2016 Cory McCartan

suppressWarnings(library("plyr"))
suppressWarnings(library("optparse"))
suppressMessages(suppressWarnings(library("maps")))
source("turnout.R")

option_list = list(
    make_option("--verbose", action="store_true", default=FALSE)
    )
opt = parse_args(OptionParser(option_list = option_list))

polls = read.csv("data/polls.csv")
states = row.names(getStateTurnout())

now = Sys.Date()
until.election = as.integer(as.Date("2016-11-08") - now)

dates = as.Date(polls$date, "%a %b %d %Y")
polls$recency = as.integer(dates - now)
recency.weights = exp(polls$recency / 10)
# add in recency weights, and weight polls with 3rd party candidates more
polls$weight = 100 * recency.weights * polls$weight * (1 + (polls$lib != -1))

# calculate how DEM and GOP lose support in 3-way race
nat.polls = polls$state == "US"
nat.lib.polls = polls$state == "US" & polls$lib != -1
nat.nolib.polls = polls$state == "US" & polls$lib == -1
nat_dem = weighted.mean(polls$dem[nat.nolib.polls], polls$weight[nat.nolib.polls])
nat_gop = weighted.mean(polls$gop[nat.nolib.polls], polls$weight[nat.nolib.polls])
nat_dem_lib = weighted.mean(polls$dem[nat.lib.polls], polls$weight[nat.lib.polls])
nat_gop_lib = weighted.mean(polls$gop[nat.lib.polls], polls$weight[nat.lib.polls])

dem_loss = nat_dem_lib - nat_dem
gop_loss = nat_gop_lib - nat_gop

if (opt$verbose) {
    cat(paste0("DEM:      ", round(100*nat_dem, 1), "%\n"))
    cat(paste0("GOP:      ", round(100*nat_gop, 1), "%\n"))
    cat(paste0("DEM LIB:  ", round(100*nat_dem_lib, 1), "%\n"))
    cat(paste0("GOP LIB:  ", round(100*nat_gop_lib, 1), "%\n"))
    cat(paste0("DEM LOSS: ", round(-100*dem_loss, 1), "%\n"))
    cat(paste0("GOP LOSS: ", round(-100*gop_loss, 1), "%\n"))
}

# apply loss
polls$dem[polls$lib == -1] = dem_loss + polls$dem[polls$lib == -1]
polls$gop[polls$lib == -1] = gop_loss + polls$gop[polls$lib == -1]

# distribute undecided
polls$dem = 0.5*polls$undecided + polls$dem
polls$gop = 0.5*polls$undecided + polls$gop

# recalculate
nat_dem = weighted.mean(polls$dem[nat.polls], polls$weight[nat.polls])
nat_gop = weighted.mean(polls$gop[nat.polls], polls$weight[nat.polls])
nat_lib = weighted.mean(polls$lib[nat.lib.polls], polls$weight[nat.lib.polls])


gap = 100 * abs(nat_dem - nat_gop)
turnout = getTurnout(gap, 80)
cat(paste0("\nTURNOUT:  ", formatC(turnout["US","total"], format="d", big.mark=","), "\n\n"))

# national trends
nat_dem_p = polls$dem[polls$state == "US"]
nat_gop_p = polls$gop[polls$state == "US"]
nat_lib_p = polls$gop[polls$state == "US"]
nat_w = polls$weight[polls$state == "US"]
nat_r = polls$recency[polls$state == "US"]

nat.dem.trend = coef(lm(nat_dem_p ~ nat_r, weights = nat_w))[[2]]
nat.gop.trend = coef(lm(nat_gop_p ~ nat_r, weights = nat_w))[[2]]
nat.lib.trend = coef(lm(nat_lib_p ~ nat_r, weights = nat_w))[[2]]

if (opt$verbose) {
    cat(paste0("DEM TREND:  ", round(700*nat.dem.trend, 1), "%\n"))
    cat(paste0("GOP TREND:  ", round(700*nat.gop.trend, 1), "%\n"))
    cat(paste0("LIB TREND:  ", round(700*nat.lib.trend, 1), "%\n"))
}

averages = ddply(polls, .(state), function(x) {
    state = toString(x$state[1])
    adjlib = x$lib[x$lib != -1]
    adjlib.w = x$weight[x$lib != -1]
    adjlib.r = x$recency[x$lib != -1]

    dem = weighted.mean(x$dem, x$weight)
    gop = weighted.mean(x$gop, x$weight)
    lib = weighted.mean(adjlib, adjlib.w)

    dem.trend = lm(dem ~ recency, data = x, weights = x$weights)
    gop.trend = lm(gop ~ recency, data = x, weights = x$weights)
    pred.dem = predict(dem.trend, data.frame(recency = until.election))[[1]]
    pred.gop = predict(gop.trend, data.frame(recency = until.election))[[1]]

    gop.state.shift = pred.dem - dem
    dem.state.shift = pred.gop - gop

    most.recent = -max(x$recency)
    dem.nat.shift = (most.recent + until.election) * nat.dem.trend
    gop.nat.shift = (most.recent + until.election) * nat.gop.trend
    lib.nat.shift = (most.recent + until.election) * nat.lib.trend

    weight = 0.25 #1 - exp(most.recent / -14)

    dem = dem + weight*(dem.state.shift + weight*dem.nat.shift)
    gop = gop + weight*(gop.state.shift + weight*gop.nat.shift)
    lib = lib + weight * lib.nat.shift

    return(data.frame(dem=dem, gop=gop, lib=lib))
})

levels(averages$state) = c(levels(averages$state), "DC")
row.names(averages) = averages$state

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
prior = data.frame(row.names=d2004$state, dem=mean_dem, gop=mean_gop)
dc_dem = prior["DC",]$dem + dem_loss
dc_gop = prior["DC",]$gop + gop_loss
dc = data.frame(state="DC", dem=dc_dem, gop=dc_gop, lib=nat_lib)

averages = rbind(averages, DC=dc)

averages$dem.win = averages$dem > averages$gop

state_names = read.csv("data/states.csv")
result = merge(averages, turnout)
r = merge(result, state_names)
row.names(r) = r$state

demVote = sum(r$total[r$state != "US"] * r$dem[r$state != "US"])
gopVote = sum(r$total[r$state != "US"] * r$gop[r$state != "US"])
libVote = sum(r$total[r$state != "US"] * r$lib[r$state != "US"])

state_dem = demVote / r["US", "total"]
state_gop = gopVote / r["US", "total"]
state_lib = libVote / r["US", "total"]

if (opt$verbose) {
    cat("\n")
    cat(paste0("STATE DEM:    ", round(state_dem*100, 1), "%\n"))
    cat(paste0("NAT. DEM:     ", round(nat_dem*100, 1), "%\n"))
    cat(paste0("STATE GOP:    ", round(state_gop*100, 1), "%\n"))
    cat(paste0("NAT. GOP:     ", round(nat_gop*100, 1), "%\n"))
    cat("\n")
}

dem = 0.67 * state_dem + 0.33 * nat_dem
gop = 0.67 * state_gop + 0.33 * nat_gop
lib = 0.67 * state_lib + 0.33 * nat_lib

dem_ev = sum(r$ev[r$dem.win == T & r$state != "US"])
gop_ev = sum(r$ev[r$dem.win == F & r$state != "US"])

cat("POPULAR VOTE\n")
cat(paste0("DEM:      ", round(dem*100, 1), "%\n"))
cat(paste0("GOP:      ", round(gop*100, 1), "%\n"))
cat(paste0("LIB:      ", round(lib*100, 1), "%\n"))
cat(paste0("OTHER:    ", round((1 - lib - dem - gop)*100, 1), "%\n\n"))

map(database="state", regions=r$full[r$dem.win == T], col="#6a80ff", fill=T)
map(database="state", regions=r$full[r$dem.win == F], col="#ff6660", fill=T, add=T)

cat("ELECTORAL COLLEGE\n")
cat(paste0("DEM:      ", dem_ev, "\n"))
cat(paste0("GOP:      ", gop_ev, "\n"))
cat("\n")
