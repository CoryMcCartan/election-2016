data = read.csv("all.csv")
attach(data)
gap = dem_pct-gop_pct
fit = glm(gap ~ gdp_pct * incumbent * relec)
fit
newdata = data.frame(gdp_pct=c(2.43), incumbent=c(0), relec=c(FALSE))
predict(fit, newdata)
pcts = seq(-5,5,by=0.1)
hypdata = data.frame(gdp_pct=pcts, incumbent=rep(0,101), relec=rep(FALSE,101))
predicted = predict(fit, hypdata)
plot(predicted)
