# Distributed Chat Application

A basic microservices-based chat application with user authentication and real-time messaging using Node.js, React, MongoDB, and WebSockets.

## Features

* User Signup & Login (with Profile Pictures)
* JWT-Based Authentication
* Real-time WebSocket Chat
* Microservice Architecture (Auth + Chat Services)
* Remote Procedure Calls (RPC) for Inter-Service Communication
* REST APIs for Resource Management
* Scalable via Microservices Pattern

## Tech Stack

Node.js, Express, React, MongoDB, Mongoose, WebSockets (`ws`), JWT, Bcrypt, Multer.

## Prerequisites

* Node.js & npm
* MongoDB Instance (Local or Cloud like MongoDB Atlas)

## Setup & Running

1.  **Clone the Repository:**  
    ```bash
    git clone https://github.com/Amirjjf/Chat-application-Distributed-System
    cd Chat-application-Distributed-System
    ```

2.  **Environment Variables:**
    * In `auth-app/backend`, create a `.env` file:
        ```dotenv
        MONGO_URI=mongodb+srv://amirjjf:<your-password>@cluster0.d7wfbqd.mongodb.net/auth-db?retryWrites=true&w=majority
        PORT=5001
        JWT_SECRET=SOME_SUPER_SECRET_KEY
        ```
    * In `chat-app/backend`, create a `.env` file:
        ```dotenv
        MONGO_URI=mongodb+srv://amirjjf:<your-password>@cluster0.d7wfbqd.mongodb.net/chat-db?retryWrites=true&w=majority
        PORT=5002
        JWT_SECRET=SOME_SUPER_SECRET_KEY
        ```
    * Ensure the `JWT_SECRET` values match across both services.

3.  **Install Dependencies in Three Terminals:**
    * Terminal 1:  
      ```bash
      cd auth-app/backend && npm install
      ```
    * Terminal 2:  
      ```bash
      cd chat-app/backend && npm install
      ```
    * Terminal 3:  
      ```bash
      cd auth-app/frontend && npm install
      ```

4.  **Run the Application:**
    * Terminal 1 (Auth Backend):  
      ```bash
      npm run dev
      # or
      npm start
      ```
      > AuthApp Server listening at `http://localhost:5001`
    * Terminal 2 (Chat Backend):  
      ```bash
      npm run dev
      # or
      npm start
      ```
      > ChatApp Server (HTTP & WebSocket) listening at `http://localhost:5002`
    * Terminal 3 (Frontend):  
      ```bash
      npm start
      ```
      > Opens `http://localhost:5173` in your browser.

---

Access the application at `http://localhost:5173`. Sign up, log in, and navigate to the chat page to start real-time messaging between users.
