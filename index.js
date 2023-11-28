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
        const publisherCollection = client.db('dailyNews').collection('publishers');

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
        

        app.get('/myarticles', async (req, res) => {

            //console.log(req.query.email);
            let query = {};
            if (req.query?.email) {
                query = { authorEmail: req.query.email }
            }
            const result = await articleCollection.find(query).toArray();
            res.send(result);
        });

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

        app.get('/searcharticles', async (req, res) => {
            const { search, publisher, tags } = req.query;
        
            let query = { status: 'approved' };
        
            if (search) {
                query.title = { $regex: search, $options: 'i' }; // Case-insensitive search in title
            }
        
            if (publisher) {
                query.publisher = new ObjectId(publisher);
            }
        
            if (tags) {
                query.tags = { $in: tags.split(",") }; // Assuming tags is a comma-separated string
            }
        
            try {
                const articles = await articleCollection.find(query).toArray();
                res.json(articles);
            } catch (error) {
                res.status(500).send("Error fetching articles: " + error);
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
        
        app.put('/articles/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const options = { upsert: true };
            const updatedArticle = req.body;
            const service = {
                $set: {
                    title: updatedArticle.title,
                    image: updatedArticle.image,
                    publisher: updatedArticle.publisher,
                    tags: updatedArticle.tags,
                    description: updatedArticle.description,

                }
            }
            const result = await articleCollection.updateOne(query, service, options);
            res.send(result);
        })

        app.patch('/articles/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const { status, declineReason, isPremium } = req.body;
        
            const updateFields = {};
            if (status) {
                updateFields.status = status;
            }
            if (status === 'declined' && declineReason) {
                updateFields.declineReason = declineReason;
            }
            if (isPremium !== undefined) {
                updateFields.isPremium = isPremium;
            }
        
            const updateDoc = {
                $set: updateFields,
            };
        
            const result = await articleCollection.updateOne(filter, updateDoc);
            res.send(result);
        });
        
          
          
        


        app.delete('/articles/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await articleCollection.deleteOne(query);
            res.send(result);
        })

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

          //update user info based on email
          app.patch('/users/:email', async (req, res) => {
            const email = req.params.email;
            const filter = { email: email }; 
            const updatedUser = req.body;
            
           
            console.log("Updating user:", updatedUser);
            
            const updateDoc = {
              $set: {
                name: updatedUser.name,
                photoURL: updatedUser.photoURL
              },
            };
            
            try {
              const result = await userCollection.updateOne(filter, updateDoc);
              
              if (result.matchedCount === 0) {
                return res.status(404).json({ message: 'User not found' });
              }
              
              if (result.modifiedCount === 0) {
                return res.status(200).json({ message: 'No changes made to the user profile' });
              }
          
              return res.json({ message: 'User updated successfully', modifiedCount: result.modifiedCount });
              
            } catch (err) {
              console.error('Error updating user:', err);
              res.status(500).json({ message: 'Internal server error' });
            }
          });

          app.patch('/updatesubscription/:email', async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updatedUser = req.body;


            console.log("Updating user:", updatedUser);

            const updateDoc = {
                $set: {
                    membershipStatus: updatedUser.membershipStatus,
                    membershipTaken: updatedUser.membershipTaken
                },
            };

            try {
                const result = await userCollection.updateOne(filter, updateDoc);

                if (result.matchedCount === 0) {
                    return res.status(404).json({ message: 'User not found' });
                }

                if (result.modifiedCount === 0) {
                    return res.status(200).json({ message: 'No changes made to the user profile' });
                }

                return res.json({ message: 'User updated successfully', modifiedCount: result.modifiedCount });

            } catch (err) {
                console.error('Error updating user:', err);
                res.status(500).json({ message: 'Internal server error' });
            }
        });

          app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
              $set: {
                role: 'admin'
              }
            }
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result);
          })

          //publisher

          app.get('/publishers', async (req, res) => {

            const cursor = publisherCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        });

          app.post('/addpublisher', async (req, res) => {

            const publisher = req.body;
            console.log(publisher);
          
            const result = await publisherCollection.insertOne(publisher);
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