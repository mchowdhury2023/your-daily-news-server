const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

require('dotenv').config()

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.psdu9fg.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        //await client.connect();

        const articleCollection = client.db('newsArticle').collection('articles');
        const userCollection = client.db('dailyNews').collection('users');

        //auth related api
        app.post('/jwt', async (req, res) => {
            const user = req.body;
    

            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '2h'
            });
            res
                .cookie('token', token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
                })
                .send({ success: true })



        })

        //article api

        app.get('/articles', async (req, res) => {
            const cursor = articleCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        })

        app.get('/articles/:id', async (req, res) => {
            const id = req.params.id;
            if (!id || id.length !== 24) {
                return res.status(400).send({ message: 'Invalid article ID' });
            }
            const query = { _id: new ObjectId(id) };
            const result = await articleCollection.findOne(query);
            res.send(result);
        })

        app.get('/trending-articles', async (req, res) => {
            try {
                const cursor = articleCollection.find().sort({ timesVisited: -1 }).limit(2); 
                const trendingArticles = await cursor.toArray();
                res.json(trendingArticles);
            } catch (error) {
                console.error(error);
                res.status(500).send({ message: "Internal Server Error" });
            }
        });
        

        app.post('/addArticles', async (req, res) => {

            const article = req.body;
            console.log(article);
            article.timesVisited = 0;
            const result = await articleCollection.insertOne(article);
            res.send(result);
        });

        app.patch('/article/:id/visit', async (req, res) => {
            const { id } = req.params;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = { $inc: { timesVisited: 1 } };
            const result = await articleCollection.updateOne(filter, updateDoc);
            res.send(result);
        });

        //user api

        app.get('/users', async (req, res) => {
            const cursor = userCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        })

        app.get('/users/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await userCollection.findOne(query);
            res.send(result);
        })

        app.post('/users', async (req, res) => {
            const user = req.body;

            user.membershipStatus = null;
            user.membershipTaken = null;
          
            const query = { email: user.email }
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
              return res.send({ message: 'user already exists', insertedId: null })
            }
            const result = await userCollection.insertOne(user);
            res.send(result);
          });
        


        // Send a ping to confirm a successful connection
       // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        //await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('Your  daily news server is running')
})

app.listen(port, () => {
    console.log(`Your  daily news server is running on port ${port}`)
})