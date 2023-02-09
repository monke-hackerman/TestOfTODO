const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const path = require("path");
const db = require("better-sqlite3")("database.db");

const app = express();

app.use(express.static(path.join(__dirname, "wwwecyn"))); //world wide web except china y northkorea
app.use(express.urlencoded({ extended: true }))

app.use(session({
    secret: "hrafnnafdafnafar",
    resave: false,
    saveUninitialized: false
}))

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

    res.redirect("/logg.html")
})
app.post(("/login"), async (req, res) => {
    let svr = req.body

    let userData = db.prepare("SELECT * FROM user WHERE email = ?").get(svr.email);
    
    if(await bcrypt.compare(svr.password, userData.hash)) {
        console.log("ye got inn")
        res.redirect("/index.html")
        req.session.LogedIn = true
        if(req.session.LogedIn === true){
            console.log("session started")
        }
    } else {
        console.log("fuck off")
        res.redirect("back")
        req.session.LogedIn = false
    }
})
app.post(("/signout"), async (req, res) => {
    console.log("byebye")
    res.redirect("/logg.html")
    req.session.LogedIn = false
    if(req.session.LogedIn === false){
        console.log("session ended")
    }
})
app.get("/index.html", (req, res) =>{
    if(req.session.LogedIn !== true){
        res.redirect("/logg.html")
        console.log("not logged inn")
    }else{
        console.log("ye got inn")
    }
})
app.listen("3000", () => {
    console.log("Server listening at http://localhost:3000")
})