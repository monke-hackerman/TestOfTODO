const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const path = require("path");
const db = require("better-sqlite3")("database.db");

const app = express();


const rootpath = path.join(__dirname, "wwwecyn")

//app.use(express.static(path.join(__dirname, "wwwecyn"))); //world wide web except china y northkorea
app.use(express.urlencoded({ extended: true }))

app.use(session({
    secret: "hrafnnafdafnafar",
    resave: false,
    saveUninitialized: false
}))
app.get("/", (req, res) =>{
    res.redirect("/index.html")
})
app.get("/reg.html", (req, res) =>{
    res.sendFile(rootpath + "/reg.html")
})

app.get("/visits", (req, res) =>{
    if(req.session.visitsCount == undefined){
        req.session.visitsCount = 1
    }else{
        req.session.visitsCount += 1
    }
    res.send("antall visits: " + req.session.visitsCount)
    console.log(req.session.visitsCount)
})
app.post(("/NyBruk"), async (req, res) => {
    let svr = req.body

    let hash = await bcrypt.hash(svr.passord, 10)
    console.log(svr)
    console.log(hash)

    db.prepare("INSERT INTO user (name, email, hash) VALUES (?, ?, ?)").run(svr.navn, svr.email, hash)

    res.redirect("/index.html")
})
app.post(("/login"), async (req, res) => {
    let svr = req.body

    let userData = db.prepare("SELECT * FROM user WHERE email = ?").get(svr.email);
    
    if(await bcrypt.compare(svr.password, userData.hash)) {
        console.log("loggedinn")
        req.session.loggedin = true
        console.log(req.session.loggedin)
        res.redirect("/index.html")
        
    }else {
        console.log("fuck off")
        res.sendFile(rootpath + "/logg.html")
        req.session.loggedin = false
    }
})
app.post(("/signout"), async (req, res) => {
    console.log("byebye")
    res.sendFile(rootpath + "/logg.html")
    req.session.loggedin = false
    if(req.session.loggedin === false){
        console.log("session ended")
    }
})
app.get("/index.html", (req, res) =>{
    if(req.session.loggedin){
        console.log("ye got inn")
        res.sendFile(rootpath + "/index.html")
    }else{
        res.sendFile(rootpath + "/logg.html")
        console.log("not logged inn")
    }
})
app.listen("3000", () => {
    console.log("Server listening at http://localhost:3000")
})