#!/usr/local/bin/Rscript
# 2016 PRESIDENTIAL ELECTION PREDICTIONS
# © 2016 Cory McCartan

# load libraries 
suppressWarnings(library("plyr"))
suppressWarnings(library("optparse"))
suppressMessages(suppressWarnings(library("maps")))
source("turnout.R")

# parse command-line arguments
option_list = list(
    make_option("--verbose", action="store_true", default=FALSE)
    )
opt = parse_args(OptionParser(option_list = option_list))

polls = read.csv("data/polls.csv")
states = row.names(getStateTurnout())

# calculate time until election
now = Sys.Date()
until.election = as.integer(as.Date("2016-11-08") - now)

# calculate recency of each poll, and a corresponding weight
dates = as.Date(polls$date, "%a %b %d %Y")
polls$recency = as.integer(dates - now)
recency.weights = exp(polls$recency / 7)

# add in recency weights, and weight polls with 3rd party candidates more
polls$weight = 100 * recency.weights * polls$weight * (1 + (polls$lib != -1))

# calculate how DEM and GOP lose support in 3-way race
nat.polls = polls$state == "US"
nat.lib.polls = polls$state == "US" & polls$lib != -1
nat.nolib.polls = polls$state == "US" & polls$lib == -1

nat_dem = weighted.mean(polls$dem[nat.nolib.polls], polls$weight[nat.nolib.polls]^2)
nat_gop = weighted.mean(polls$gop[nat.nolib.polls], polls$weight[nat.nolib.polls]^2)
nat_dem_lib = weighted.mean(polls$dem[nat.lib.polls], polls$weight[nat.lib.polls]^2)
nat_gop_lib = weighted.mean(polls$gop[nat.lib.polls], polls$weight[nat.lib.polls]^2)

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

# apply loss to all polls
polls$dem[polls$lib == -1] = dem_loss + polls$dem[polls$lib == -1]
polls$gop[polls$lib == -1] = gop_loss + polls$gop[polls$lib == -1]

# national trends
nat_dem_p = polls$dem[nat.lib.polls]
nat_gop_p = polls$gop[nat.lib.polls]
nat_lib_p = polls$lib[nat.lib.polls]
nat_und_p = polls$undecided[nat.lib.polls]
nat_w = polls$weight[nat.lib.polls]
nat_r = polls$recency[nat.lib.polls]

nat.dem.trend = coef(lm(nat_dem_p ~ nat_r, weights = nat_w))[[2]]
nat.gop.trend = coef(lm(nat_gop_p ~ nat_r, weights = nat_w))[[2]]
nat.lib.trend = coef(lm(nat_lib_p ~ nat_r, weights = nat_w))[[2]]
nat.und.trend = coef(lm(nat_und_p ~ nat_r, weights = nat_w))[[2]]
# rebalance trendss so 'other' voters aren't too affected
avg.trend = (nat_dem*nat.dem.trend + nat_gop*nat.gop.trend
             + weighted.mean(nat_lib_p, nat_w)*nat.lib.trend
             + weighted.mean(nat_und_p, nat_w)*nat.und.trend)
nat.dem.trend = nat.dem.trend - 0.1*avg.trend
nat.gop.trend = nat.gop.trend - 0.1*avg.trend
nat.lib.trend = nat.lib.trend - 0.1*avg.trend
nat.und.trend = nat.und.trend - 0.1*avg.trend

# apply trends
weight = 0.75
nat_dem_shift = nat.dem.trend * weight * until.election
nat_gop_shift = nat.gop.trend * weight * until.election
nat_lib_shift = nat.lib.trend * weight * until.election
nat_und_shift = nat.lib.trend * weight * until.election

# rebalance undecided voters and apply trends
polls$undecided[nat.polls] = polls$undecided[nat.polls] + nat_und_shift
polls$dem[nat.polls] = polls$dem[nat.polls] + nat_dem_shift + 0.5*polls$undecided[nat.polls]
polls$gop[nat.polls] = polls$gop[nat.polls] + nat_gop_shift + 0.5*polls$undecided[nat.polls]
polls$lib[nat.lib.polls] = polls$lib[nat.lib.polls] + nat_lib_shift

# recalculate
nat_dem = weighted.mean(polls$dem[nat.polls], polls$weight[nat.polls])
nat_gop = weighted.mean(polls$gop[nat.polls], polls$weight[nat.polls])
nat_lib = weighted.mean(polls$lib[nat.lib.polls], polls$weight[nat.lib.polls])

# calculate gap and use it to predict turnout
gap = 100 * abs(nat_dem - nat_gop)
turnout = getTurnout(gap, 80)
cat(paste0("\nTURNOUT:  ", formatC(turnout["US","total"], format="d", big.mark=","), "\n\n"))


if (opt$verbose) {
    cat(paste0("DEM TREND:  ", round(700*nat.dem.trend, 1), "%\n"))
    cat(paste0("GOP TREND:  ", round(700*nat.gop.trend, 1), "%\n"))
    cat(paste0("LIB TREND:  ", round(700*nat.lib.trend, 1), "%\n"))
    cat(paste0("UND TREND:  ", round(700*nat.und.trend, 1), "%\n"))
}

# Calculate state averages
averages = ddply(polls, .(state), function(x) {
    # setup
    state = toString(x$state[1])
    adjlib = x$lib[x$lib != -1]
    adjlib.w = x$weight[x$lib != -1]
    adjlib.r = x$recency[x$lib != -1]

    # initial calculations
    dem = weighted.mean(x$dem, x$weight)
    gop = weighted.mean(x$gop, x$weight)
    lib = weighted.mean(adjlib, adjlib.w)

    # calculate trends
    dem.trend = lm(dem ~ recency, data = x, weights = x$weight)
    gop.trend = lm(gop ~ recency, data = x, weights = x$weight)
    und.trend = lm(undecided ~ recency, data = x, weights = x$weight)
    pred.dem = predict(dem.trend, data.frame(recency = until.election))[[1]]
    pred.gop = predict(gop.trend, data.frame(recency = until.election))[[1]]
    pred.und = predict(und.trend, data.frame(recency = until.election))[[1]]

    # calculate shift on national and state level
    dem.state.shift = pred.dem - weighted.mean(x$dem, x$weight)
    gop.state.shift = pred.gop - weighted.mean(x$gop, x$weight)
    und.state.shift = pred.und - weighted.mean(x$undecided, x$weight)

    most.recent = -max(x$recency)
    dem.nat.shift = (most.recent + until.election) * nat.dem.trend
    gop.nat.shift = (most.recent + until.election) * nat.gop.trend
    und.nat.shift = (most.recent + until.election) * nat.und.trend
    lib.nat.shift = (most.recent + until.election) * nat.lib.trend

    # calculate combined shift
    net_dem_shift = weight * (0.33*dem.state.shift + 0.67*dem.nat.shift)
    net_gop_shift = weight * (0.33*gop.state.shift + 0.67*gop.nat.shift)
    net_und_shift = weight * (0.33*und.state.shift + 0.67*und.nat.shift)
    net_lib_shift = weight * lib.nat.shift

    # rebalance undecided  voters and apply shifts
    x$undecided = x$undecided + net_und_shift
    x$gop = x$gop + net_gop_shift + 0.5*x$undecided
    x$dem = x$dem + net_dem_shift + 0.5*x$undecided
    adjlib = adjlib + net_lib_shift

    # recalculate
    dem = weighted.mean(x$dem, x$weight)
    gop = weighted.mean(x$gop, x$weight)
    lib = weighted.mean(adjlib, adjlib.w)

    return(data.frame(dem=dem, gop=gop, lib=lib))
})

# Calculate DC votes, because there is no polling for DC
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

state_names = read.csv("data/states.csv")
result = merge(averages, turnout)
r = merge(result, state_names)
row.names(r) = r$state
state.only = r$state != "US"

# calculate popular vote
demVote = sum(r$total[state.only] * r$dem[state.only])
gopVote = sum(r$total[state.only] * r$gop[state.only])

libVote = sum(r$total[state.only] * r$lib[state.only])
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
    print(data.frame(gap=round(100*(r$dem - r$gop), 1), row.names=r$state))
    cat("\n")
}

dem = 0.5 * state_dem + 0.5 * nat_dem
gop = 0.5 * state_gop + 0.5 * nat_gop
lib = 0.5 * state_lib + 0.5 * nat_lib

cat("POPULAR VOTE\n")
cat(paste0("DEM:      ", round(dem*100, 1), "%\n"))
cat(paste0("GOP:      ", round(gop*100, 1), "%\n"))
cat(paste0("LIB:      ", round(lib*100, 1), "%\n"))
cat(paste0("OTHER:    ", round((1 - lib - dem - gop)*100, 1), "%\n\n"))


# Calculate state winners and display electoral college map
r$dem.win = r$dem > r$gop
dem_ev = sum(r$ev[r$dem.win == T & state.only])
gop_ev = sum(r$ev[r$dem.win == F & state.only])

map(database="state", regions=r$full[r$dem.win == T], col="#6a80ff", fill=T)
map(database="state", regions=r$full[r$dem.win == F], col="#ff6660", fill=T, add=T)

cat("ELECTORAL COLLEGE\n")
cat(paste0("DEM:      ", dem_ev, "\n"))
cat(paste0("GOP:      ", gop_ev, "\n"))
cat("\n")
