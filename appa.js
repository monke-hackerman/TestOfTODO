const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const path = require("path");
const db = require("better-sqlite3")("databaseer.sdb"/*, { verbose: console.log }*/); //verbose er i en kommentar når koden faktisk skal kjøre siden den er der kun for feilsøking
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


// alt du trenger for session til å fungere
app.use(session({
    secret: "hrafnnafdafnafar",
    resave: false,
    saveUninitialized: false
}))

//ikke bruk men dette er en handler som kan skjekke visits 
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


// alt for logginn

//handler for å komme inn på registreings side
app.get("/reg.html", (req, res) => {
    res.sendFile(rootpath + "/reg.html")
    
})

//ny bruker registrering
app.post(("/NyBruk"), async (req, res) => {
    let svr = req.body

    let hash = await bcrypt.hash(svr.passord, 10)
    console.log(svr)
    console.log(hash)

    //regex er for å skjekke om noen boksatver er lov
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

//handler for login skjekk
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
//handler for sign out
app.get(("/signout"), async (req, res) => {
    console.log("byebye")
    res.sendFile(rootpath + "/logg.html")
    
    req.session.loggedin = false
    if (req.session.loggedin === false) {
        console.log("session ended")
    }
})

//hoved root brukes for redirect til framside eller til innlogging hvis session ikke er gyldig
function Hoved(req, res) {
    if (req.session.loggedin) {
        console.log("ye got inn", req.session.username)

        res.redirect("/list")
    } else {
        res.sendFile(rootpath + "/logg.html")
        
        console.log("not logged inn")
    }
}
//to handlers som bruker hoved function over
app.get("/hoved", Hoved)
app.get("/", Hoved)

//alt for to do lister også skjent som hovedside
//handler som sender deg til listen din
app.get("/list", (req, res) => {
    //skjekker om du er faktisk logget inn og hvis ikke sender deg til logginside
    if (!req.session.loggedin) {
        res.sendFile(rootpath + "/logg.html")
        
        console.log("not logged in")
        return
    }

    const userId = req.session.userID

    //vi lager en sql spøring som joiner tabelen ToDoLists og listElement
    const toDoLists = db.prepare(`
        SELECT tl.id, tl.name, le.name AS elementName, le.done, le.id AS elementId
        FROM ToDoLists tl 
        LEFT JOIN ListElement le ON tl.id = le.ToDoLists_id 
        WHERE tl.user_id = ? 
        ORDER BY tl.id, le.id
    `).all(userId)

    //så lager vi en liste hvor vi setter inn all informasjonen
    const lists = {}
    toDoLists.forEach((row) => {
        const listId = row.id
        const listName = row.name
        const elementId = row.elementId
        const elementName = row.elementName
        const elementDone = row.done
        
        //enne if statmente sjekker om et objekt med listId eksisterer hvis det ikke eksisterer oppretter den et nytt objekt
        if (!lists.hasOwnProperty(listId)) {
        lists[listId] = {
            id: listId,
            name: listName,
            elements: []
        }
        }
        //dette if statmente legger til nye elementer i hver liste som ikke er lik null.
        if (elementName !== null) {
        lists[listId].elements.push({
            id: elementId,
            name: elementName,
            done: elementDone
        })
        }
    })

    res.render("listoverview.hbs", {
        PersonName: req.session.username,
        ListsOwn: Object.values(lists)
    })
})
//handler for å lage nye todolister
app.post(("/makelist"), (req, res) => {
    let svr = req.body
    let userid = req.session.userID
    let taggid = []
    //skjekker om du er faktisk logget inn og hvis ikke sender deg til logginside
    if (!userid) {
        res.sendFile(rootpath + "/logg.html")
        
        console.log("not logged inn")
    }
    //først setter vi inn info i todolist
    let insert = db.prepare(`INSERT INTO ToDoLists (name, user_id) VALUES (?, ?)`).run(svr.todo, userid)

    //så finner vi ut om det er flere eller bare en tag
    if (typeof svr.tags === "string") { //hvos det er bare en tag kommer det ut som string og vi pusher det bare inn en gang
        console.log(svr.tags)
        taggid.push(...db.prepare(`SELECT id FROM tags WHERE name = ?`).all(svr.tags))
    }
    else if (Array.isArray(svr.tags)) { // hvis det er flere tags har vi en foreach løkke som går gjennom og pusher inn tag id en og en
        console.log(svr.tags)
        svr.tags.forEach(tags => {
            taggid.push(...db.prepare(`SELECT id FROM tags WHERE name = ?`).all(tags))
        })

    } else { //dette kjører hvis det er ingen tags
        console.log("no tag")
    }
    console.log(taggid)
    //her setter vi inn tag id som vi fant i hvis løkken ovver
    taggid.forEach(({ id }) => {
        db.prepare(`INSERT INTO ToDoLists_has_tags (ToDoLists_id, tags_id) VALUES (?, ?)`).run(insert.lastInsertRowid, id)
    })

    res.redirect("/list")

})
//handler for å skjekke tags som du velger
app.post("/CheckTags", (req, res) => {   
    let svr = req.body
    const userId = req.session.userID
    if(svr.tags === "ViewAll"){
        res.redirect("/list")
    }


    //vi lager en sql spøring som joiner tabelen ToDoLists og listElement likt som list handleren 
    //men her joiner vi også tags og todolist has tags for å få tak i kun det med riktig tag
    const toDoLists = db.prepare(`
    SELECT tl.id, tl.name, le.name AS elementName, le.done, le.id AS elementId 
    FROM ToDoLists tl 
    LEFT JOIN ListElement le ON tl.id = le.ToDoLists_id 
    JOIN ToDoLists_has_tags t ON tl.id = t.ToDoLists_id 
    JOIN Tags tg ON t.Tags_id = tg.id 
    WHERE tl.user_id = ? AND tg.name = '${svr.tags}' 
    ORDER BY tl.id, le.id;
    `).all(userId)

    //så lager vi en liste hvor vi setter inn all informasjonen
    const lists = {}
    toDoLists.forEach((row) => {
        const listId = row.id
        const listName = row.name
        const elementId = row.elementId
        const elementName = row.elementName
        const elementDone = row.done
        
        //enne if statmente sjekker om et objekt med listId eksisterer hvis det ikke eksisterer oppretter den et nytt objekt
        if (!lists.hasOwnProperty(listId)) {
        lists[listId] = {
            id: listId,
            name: listName,
            elements: []
        }
        }
        //dette if statmente legger til nye elementer i hver liste som ikke er lik null.
        if (elementName !== null) {
        lists[listId].elements.push({
            id: elementId,
            name: elementName,
            done: elementDone
        })
        }
    })
    res.render("listoverview.hbs", {
    PersonName: req.session.username,
    ListsOwn: Object.values(lists)
    })
})
//handler for å slette eb hel todolist
app.post(("/deleteList"), (req, res) => {
    let svr = req.body
    db.prepare(`DELETE FROM ListElement WHERE ToDoLists_id = ?;`).run(svr.DelId) // først sletter vi elementene i listen
    db.prepare(`DELETE FROM ToDoLists_has_tags WHERE ToDoLists_id = ?;`).run(svr.DelId) // så sletter vi tagsene den har
    db.prepare(`DELETE FROM ToDoLists WHERE id = ?;`).run(svr.DelId)//så kan vi slette listen uten forgin key constraint
    res.redirect("/list")
})

//her er handlers for alle liste elementer lagd under todolistene
//handler for å lage ett nytt liste element i en todolist
app.post("/makeElement", (req, res) => {
    let svr = req.body
    db.prepare(`INSERT INTO ListElement (name, done, ToDoLists_id) VALUES (?, ?, ?)`).run(svr.elementname, 0, svr.Listname)
    
    res.redirect("/list")

})
//handler for å kunne trykke på done/not done kanppen og den bytter seg
app.post("/ThingDone", (req, res) => {
    let svr = req.body

    let doneOrNot = db.prepare(`SELECT done FROM ListElement WHERE id = ?`).all(svr.DonId)
    //her skjekker vi om done er 1 eller 0 for å bytte til alternativet
    if(doneOrNot[0].done == 0){
        db.prepare(`UPDATE ListElement SET done = 1 WHERE id = ?;`).run(svr.DonId)
    }else if(doneOrNot[0].done == 1){
        db.prepare(`UPDATE ListElement SET done = 0 WHERE id = ?;`).run(svr.DonId)
    }else{
        console.log("You done goofed up boi")
    }
    res.redirect("/list")
})
//handler for å kun slette ett liste element
app.post("/DelElement", (req, res) => {
    let svr = req.body

    db.prepare(`DELETE FROM ListElement WHERE id = ?;`).run(svr.LeDelId)
    
    res.redirect("/list")
})

//alle handlers for bruker info siden 
//handler for å faktisk kunne komme seg inn på siden
app.get("/userInfo", (req, res) => {
    if (!req.session.loggedin) {
        res.sendFile(rootpath + "/logg.html")
        
        console.log("not logged in")
        return
    }
    const userId = req.session.userID
    let userInfo = db.prepare(`SELECT * FROM user WHERE id = ?`).all(userId)
    req.session.username = userInfo[0].name
    res.render("hoved.hbs", {
        PersonName: req.session.username,
        Username: userInfo[0].name,
        Email: userInfo[0].email,
        Id: userId
    })
})
//handler for når du bytter brukernavn
app.post("/changeUsername", (req, res) => {
    let svr = req.body
    const userId = req.session.userID
     //regex er for å skjekke om noen boksatver er lov
    // \w = A-Z, a-z, and _
    // \W = NOT A-Z, NOT a-z, and NOT _
    const allowedRegex = /\W/g
    const NewUsername = svr.newUsername

    if (allowedRegex.test(NewUsername)) {
        return res.redirect("/userInfo?error=invalid_username")
    }
    db.prepare(`UPDATE user SET name = ? WHERE id = ?;`).run(NewUsername, userId)
    res.redirect("/userInfo")
})
//handler for når du bytter email
app.post("/changeEpost", (req, res) => {
    let svr = req.body
    const userId = req.session.userID

    db.prepare(`UPDATE user SET email = ? WHERE id = ?;`).run(svr.newEmail, userId)
    res.redirect("/userInfo")
})
//handler for å slette all data om en bruker
app.post("/DeleteUser", (req, res) => {
    let svr = req.body
    const userId = req.session.userID
    //først finner vi todolistene brukeren eier
    let Tlid = db.prepare(`SELECT id FROM ToDoLists WHERE user_id = ?;`).all(userId)

    //så sletter vi hvert list element og tag listen hadde men
    if (typeof Tlid === "string") { //hvis det er bare en tag kommer det ut som string og vi sletter vi det bare med en gang 
        db.prepare(`DELETE FROM ListElement WHERE ToDoLists_id = ?;`).run(Tlid[0].id)
        db.prepare(`DELETE FROM ToDoLists_has_tags WHERE ToDoLists_id = ?;`).run(Tlid[0].id)
    }
    else if (Array.isArray(Tlid)) { // hvis det er flere tags har vi en foreach løkke som går gjennom og sletter en og en


        for(let i = 0; i < Tlid.length; i++){
            db.prepare(`DELETE FROM ListElement WHERE ToDoLists_id = ?;`).run(Tlid[i].id)
            db.prepare(`DELETE FROM ToDoLists_has_tags WHERE ToDoLists_id = ?;`).run(Tlid[i].id)
        }

    } else {
        console.log("time to kys")
    }
    //så sletter vi selve todolistene og så tilslutt brukeren
    db.prepare(`DELETE FROM ToDoLists WHERE user_id = ?;`).run(userId)
    db.prepare(`DELETE FROM user WHERE id = ?;`).run(userId)

    req.session.loggedin = false
    res.redirect("/")
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