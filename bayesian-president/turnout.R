# 2016 PRESIDENTIAL ELECTION PREDICTIONS
# © 2016 Cory McCartan

getVAP = function() {
    pop = read.csv("data/population.csv")
    clean = data.frame(row.names=pop$GEO.display.label)

    clean$vap_2010 = pop$est72010sex0_age18plus
    clean$vap_2011 = pop$est72011sex0_age18plus
    clean$vap_2012 = pop$est72012sex0_age18plus
    clean$vap_2013 = pop$est72013sex0_age18plus
    clean$vap_2014 = pop$est72014sex0_age18plus
    clean$vap_2015 = pop$est72015sex0_age18plus

    pop = as.data.frame(t(clean))
    pop$year = c(2010, 2011, 2012, 2013, 2014, 2015)

    vap_model = nls(US ~ SSlogis(year, x1, x2, x3), data = pop)
    VAP = predict(vap_model, newdata = data.frame(year = 2016))

    return(as.integer(VAP))
}

getTurnout = function() {
	data = read.csv("data/turnout.csv")
	weights = exp((data$year - 2012) / 500)
	percent = weighted.mean(data$turnout, weights) / 100
	VAP = getVAP()

	return(VAP * percent)
}
