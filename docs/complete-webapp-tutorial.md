---
id: complete-webapp-tutorial
title: Complete Webapp Tutorial
sidebar_label: Complete Webapp Tutorial
---


<br/>
We want to make a webapp version of [HOTDOG or NOT HOTDOG](https://www.theverge.com/2017/6/26/15876006/hot-dog-app-android-silicon-valley)!



## App Description
Assume we want to create a webapp that shows a list of photos with a line describing whether the image is a hotdog or not hotdog, something like this:

- <IMAGE> Tags: Hotdog, Upload date: 2017-11-12
- <ANOTHER IMAGE> Tags: NOT Hotdog, Upload date: 2017-07-08
- <ANOTHER IMAGE> Tags: Hotdog, Upload date: 2017-07-07
- ....

Anyone can upload images and our very smart Artificial Intelligence tags that image with HOTDOG or NOT-HOTDOG, then we save that image on the server and we also save upload date and tags in the database.

## App Architecture
To make this app, let's assume we decided to have the following components:
- NodeJS WebApp: (including static assets, frontend app, and API)
- PHP Image Upload app - where we can make a POST request to save a photo on disk
- MongoDB where we can store upload information (tags, upload date and etc)
- PYTHON An Image Recognition service where we can make a POST request to know whether the image is a HOTDOG or NOT HOTDOG

```
                        +---------------------+
                        |                     |
                        |   NodeJS Webapp     |
                        |                     |
        +---------------+------------+--------+-----------------+
        |                            |                          |
        |                            |                          |
        |                            |                          |
        |                            |                          |
        |                            |                          |
+-------v-----------+     +----------v----------+   +-----------v---+
|                   |     |                     |   |               |
| PHP File Uploader |     | Python ImageDetector|   |    MongoDB    |
|                   |     |                     |   |               |
+-------------------+     +---------------------+   +---------------+

```

## Persistence or Not
CaptainDuckDuck allows you to indicate whether your app/database/service has persistence data or not. Apps with persistence can have "persistent directories". These directories will be preserved if your app crashes and Captain starts a new instance of that app. All other directories will get wiped and reset to their default state if the application crashes and Captain starts a new instance of the app. In our example:
- WebApp: DOES NOT have/need any persistence.
- Image Upload App: Needs a persistent directory where images get saved on disk (for example, `/uploaded_files`)
- MongoDB. Of course, this needs persistency (where we store information), we don't want to lose the database, just because our MongoDB crashed or our server got restarted.
- PYTHON Image Recognition app. This one does not need to save any data on disk. It simply receives an image, does some image processing and let the client know whether the image was HOTDOG or NOT HOTDOG

## Creating Services:
- NodeJS Web app: after you write this app, you simply create a webapp and name it `my-webapp` on Captain, you DO NOT check the persistency checkbox and you deploy your app.
- Image Upload app: similar to webapp described above, but we'll check the persistence checkbox when creating the app. Name this app `image-uploader`. After that, we go to app details page and add a persistent directory, the path of the directory is where your app stores images. This depends on your app, in our example, let's assume it is `/uploaded_files`
- MongoDB: we'll use the one-click app installer to create an instance of MongoDB. We'll name this container `my-mongodb`. When the container (database) is created, you can go to the details page and you'll see that Captain automatically assigned some persistent directories to this container. This is where MongoDB saves its data.
- Python Image Recognition app: Again, create a new app on Captain. We do not need to set persistence for this app as it does not save any information on the disk. Let's name this app `image-processor`. 


## Internal Access
In order for your web-app to work. It needs to be able to talk to MongoDB instance, image uploader, and image processor. You can simply add a `srv-captain--` prefix to the name of the container if you want to access it from another container. For example in order to connect to your MongoDB instance which we name `my-mongodb`, you can add the following line to your NodeJS application (using mongoose library)
```
mongoose.connect("mongodb://srv-captain--my-mongodb/mydatabase", { useMongoClient: true });
```
Of course, you can add username and password to the URI, see [here for example](https://stackoverflow.com/questions/7486623/mongodb-password-with-in-it).

This is the same for other services; if you want to upload an image to your image uploader service you can just access it via `http://srv-captain--imageuploader`
