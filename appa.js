const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const path = require("path");
const db = require("better-sqlite3")("databaseer.sdb", {verbose: console.log});
const hbs = require('hbs')
const app = express();


const rootpath = path.join(__dirname, "wwwecyn")

app.use(express.static(path.join(__dirname, "other"))); //world wide web except china y northkorea
const viewPath = path.join(__dirname, "/views/pages")
const partialsPath = path.join(__dirname, "/views/partials")
app.set("view engine", hbs)
app.set('views', viewPath)
hbs.registerPartials(partialsPath)
app.use(express.urlencoded({ extended: true }))


app.use(session({
    secret: "hrafnnafdafnafar",
    resave: false,
    saveUninitialized: false
}))
// alt for logginn
app.get("/reg.html", (req, res) => {
    res.sendFile(rootpath + "/reg.html")
})

//ikke bruk men kan skjekke visits

/*
app.get("/visits", (req, res) => {
    if (req.session.visitsCount == undefined) {
        req.session.visitsCount = 1
    } else {
        req.session.visitsCount += 1
    }
    res.send("antall visits: " + req.session.visitsCount)
    console.log(req.session.visitsCount)
})
*/

//ny bruker registrering
app.post(("/NyBruk"), async (req, res) => {
    let svr = req.body

    let hash = await bcrypt.hash(svr.passord, 10)
    console.log(svr)
    console.log(hash)

    // \w = A-Z, a-z, and _
    // \W = NOT A-Z, NOT a-z, and NOT _
    const allowedRegex = /\W/g  
    const navn = svr.navn

    if (allowedRegex.test(navn)) {
        return res.redirect("/reg.html?error=invalid_username")
    }

    db.prepare("INSERT INTO user (name, email, hash) VALUES (?, ?, ?)").run(svr.navn, svr.email, hash)

    res.redirect("/hoved")
})
//login skjekk
app.post(("/login"), async (req, res, next) => {
    let svr = req.body
    let UserORemail = ""
    console.log(svr.emailORuser.includes("@"));

    if (svr.emailORuser.includes("@")) {
        UserORemail = "email"
    } else {
        UserORemail = "name"
    }
    console.log("waiting")
    let userData = db.prepare(`SELECT * FROM user WHERE ${UserORemail} = ?;`).get(svr.emailORuser);
    console.log(userData)

    if (!userData) {
        return res.redirect("/?error=not_found")
    }

    if (await bcrypt.compare(svr.password, userData.hash)) {
        console.log(userData.name, "loggedinn")
        req.session.username = userData.name
        req.session.userID = userData.id
        req.session.loggedin = true
        console.log(req.session.loggedin)
        res.redirect("/hoved")

    } else {
        console.log("fuck off")
        res.sendFile(rootpath + "/logg.html")
        req.session.loggedin = false
    }
})
//sign out
app.post(("/signout"), async (req, res) => {
    console.log("byebye")
    res.sendFile(rootpath + "/logg.html")
    req.session.loggedin = false
    if (req.session.loggedin === false) {
        console.log("session ended")
    }
})
//hoved root brukes for framside og redirect til innlogging
function Hoved(req, res) {
    if (req.session.loggedin) {
        console.log("ye got inn", req.session.username)

        res.redirect("/list")
    } else {
        res.sendFile(rootpath + "/logg.html")
        console.log("not logged inn")
    }
}
app.get("/hoved", Hoved)
app.get("/", Hoved)

//alt for lister
//sender deg til listen din
app.get("/list", (req, res) => {
    let id = req.session.userID
    console.log(id)
    if(!id){
        res.sendFile(rootpath + "/logg.html")
        console.log("not logged inn")
    }

    let ListsName = db.prepare(`SELECT name FROM ToDoLists WHERE user_id = ? LIMIT 500;`).all(id)

    res.render("listoverview.hbs", {
        PersonName: req.session.username
    })
})
app.post(("/makelist"), (req, res) => {
    let svr = req.body
    let userid = req.session.userID
    if(!userid){
        res.sendFile(rootpath + "/logg.html")
        console.log("not logged inn")
    }
    db.prepare(`INSERT INTO ToDoLists (name, user_id) VALUES (?, ?)`).run(svr.todo, userid)
    res.redirect("/list")

})
app.get("/getlist", (req, res) => {
    res.render("list.hbs", {
        listoverview: "hello"
    })
    
})
//prøver å stoppe serveren fra å stoppe hvis den krasjer
app.use((err, req, res, next) => {
    console.warn(err.stack)
    res.status(500).send("error 500 internal server error")
})

//hvilken port appen er på
app.listen("3000", () => {
    console.log("Server listening at http://localhost:3000")
})