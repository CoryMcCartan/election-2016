#!/usr/local/bin/Rscript
# 2016 PRESIDENTIAL ELECTION PREDICTIONS
# © 2016 Cory McCartan

library("plyr")
source("prior.R")
source("turnout.R")

polls = read.csv("data/polls.csv")
states = row.names(getStateTurnout())

dates = as.Date(polls$date, "%a %b %d %Y")
recency.weights = exp(0.5 * as.integer(dates - Sys.Date()))
# add in recency weights, and weight polls with 3rd party candidates more
polls$weight = 100 * recency.weights * polls$weight * (1 + (polls$lib != -1))

# calculate how DEM and GOP lose support in 3-way race
nat_dem = mean(polls$dem[polls$state == "US" & polls$lib == -1])
nat_gop = mean(polls$gop[polls$state == "US" & polls$lib == -1])
nat_dem_lib = mean(polls$dem[polls$state == "US" & polls$lib != -1])
nat_gop_lib = mean(polls$gop[polls$state == "US" & polls$lib != -1])

dem_loss = nat_dem_lib - nat_dem
gop_loss = nat_gop_lib - nat_gop

# apply loss
polls$dem[polls$lib == -1] = dem_loss + polls$dem[polls$lib == -1]
polls$gop[polls$lib == -1] = gop_loss + polls$gop[polls$lib == -1]

# distribute undecided
polls$dem = 0.5*polls$undecided + polls$dem
polls$gop = 0.5*polls$undecided + polls$gop

# recalculate
nat_dem = weighted.mean(polls$dem[polls$state == "US"], polls$weight[polls$state == "US"])
nat_gop = weighted.mean(polls$gop[polls$state == "US"], polls$weight[polls$state == "US"])
nat_lib = weighted.mean(polls$lib[polls$state == "US" & polls$lib != -1], 
                        polls$weight[polls$state == "US" & polls$lib != -1])


gap = 100 * abs(nat_dem - nat_gop)
turnout = getTurnout(gap, 80)
cat(paste0("\nTURNOUT:  ", formatC(turnout["US","total"], format="d", big.mark=","), "\n\n"))

averages = ddply(polls, .(state), function(x) {
    state = toString(x$state[1])
    dem = weighted.mean(x$dem, x$weight)
    gop = weighted.mean(x$gop, x$weight)
    lib = weighted.mean(x$lib[x$lib != -1], x$weight[x$lib != -1])

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

result = merge(averages, turnout)
row.names(result) = result$state

demVote = sum(result$total[result$state != "US"] * result$dem[result$state != "US"])
gopVote = sum(result$total[result$state != "US"] * result$gop[result$state != "US"])
libVote = sum(result$total[result$state != "US"] * result$lib[result$state != "US"])

state_dem = demVote / result["US", "total"]
state_gop = gopVote / result["US", "total"]
state_lib = libVote / result["US", "total"]

dem = 0.67 * state_dem + 0.33 * nat_dem
gop = 0.67 * state_gop + 0.33 * nat_gop
lib = 0.67 * state_lib + 0.33 * nat_lib

cat(paste0("DEM:      ", round(dem*100, 1), "%\n"))
cat(paste0("GOP:      ", round(gop*100, 1), "%\n"))
cat(paste0("LIB:      ", round(lib*100, 1), "%\n"))
cat(paste0("OTHER:    ", round((1 - lib - dem - gop)*100, 1), "%\n\n"))
print(result[, "dem.win", drop=FALSE])
cat("\n")
