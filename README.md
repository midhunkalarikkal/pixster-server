# PIXSTER-SERVER

### Backend Service for Pixster

**PIXSTER-SERVER** is the backend service powering **Pixster**, a social media application built with a modern Node.js backend and React-based frontend.

It provides the core backend infrastructure for authentication, API services, data persistence, media storage, caching, and real-time communication.

<p align="left">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express.js" />
  <img src="https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/MongoDB_Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB Atlas" />
  <img src="https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white" alt="JWT" />
  <img src="https://img.shields.io/badge/Amazon_S3-569A31?style=for-the-badge&logo=amazons3&logoColor=white" alt="Amazon S3" />
  <img src="https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis" />
  <img src="https://img.shields.io/badge/Socket.IO-010101?style=for-the-badge&logo=socketdotio&logoColor=white" alt="Socket.IO" />
  <img src="https://img.shields.io/badge/npm-CB3837?style=for-the-badge&logo=npm&logoColor=white" alt="npm" />
  <img src="https://img.shields.io/badge/Amazon_EC2-FF9900?style=for-the-badge&logo=amazonec2&logoColor=white" alt="Amazon EC2" />
  <img src="https://img.shields.io/badge/nginx-009639?style=for-the-badge&logo=nginx&logoColor=white" alt="nginx" />
</p>

---

## Overview

PIXSTER-SERVER provides the backend infrastructure for the Pixster platform.

The service is responsible for:

- 🔐 **Authentication & Authorization**
- 🌐 **REST API Services**
- 🗄️ **Database Operations**
- 🖼️ **Media Storage**
- ⚡ **Redis Caching**
- 🔄 **Real-Time Communication**
- 🔗 **Client–Server Integration**

The backend is designed to support the core functionality of the Pixster social media platform while providing a scalable foundation for its production deployment.

---

## Architecture

```text
                         PIXSTER
                            │
                            │
                 ┌──────────▼──────────┐
                 │    Pixster Client   │
                 │ React + Vite        │
                 └──────────┬──────────┘
                            │
                 REST API / Socket.IO
                            │
                            ▼
                 ┌─────────────────────┐
                 │   PIXSTER-SERVER    │
                 │ Node.js + Express   │
                 └──────────┬──────────┘
                            │
            ┌───────────────┼────────────────┐
            │               │                │
            ▼               ▼                ▼
      MongoDB Atlas       Redis           Amazon S3
       Database          Caching        Media Storage
```

---

## Core Responsibilities

### Authentication

Handles user authentication and authorization using **JWT-based authentication**.

### API Services

Provides the backend REST APIs required by the Pixster Client for application functionality and data operations.

### Data Management

Uses **MongoDB** as the primary database for persistent application data.

### Media Storage

Uses **Amazon S3** for storing and serving user-generated media.

### Caching

Uses **Redis** for caching and temporary server-side data.

### Real-Time Communication

Uses **Socket.IO** to provide real-time communication between the client and server.

---

## Production

PIXSTER-SERVER is deployed in a production environment using AWS infrastructure.

<p align="left">
  <img src="https://img.shields.io/badge/AWS-232F3E?style=for-the-badge&logo=amazonaws&logoColor=white" alt="AWS" />
  <img src="https://img.shields.io/badge/Amazon_EC2-FF9900?style=for-the-badge&logo=amazonec2&logoColor=white" alt="Amazon EC2" />
  <img src="https://img.shields.io/badge/nginx-009639?style=for-the-badge&logo=nginx&logoColor=white" alt="nginx" />
  <img src="https://img.shields.io/badge/MongoDB_Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB Atlas" />
  <img src="https://img.shields.io/badge/Amazon_S3-569A31?style=for-the-badge&logo=amazons3&logoColor=white" alt="Amazon S3" />
</p>

### Deployment Stack

| Service           | Purpose                    |
| ----------------- | -------------------------- |
| **Amazon EC2**    | Backend application server |
| **nginx**         | Reverse proxy              |
| **MongoDB Atlas** | Production database        |
| **Amazon S3**     | Media storage              |

---

## Project Status

<p align="left">
  <img src="https://img.shields.io/badge/Status-Production-success?style=for-the-badge" alt="Production" />
  <img src="https://img.shields.io/badge/Project-Portfolio-blue?style=for-the-badge" alt="Portfolio Project" />
</p>

PIXSTER-SERVER is actively maintained as part of the Pixster portfolio project.

---

## Related Project

### [Pixster Client](https://github.com/midhunkalarikkal/pixster-client)

The **Pixster Client** is the frontend application for the Pixster social media platform.

Built with **React, Vite, Tailwind CSS, Zustand, and Socket.IO**, it provides the user-facing interface and communicates with PIXSTER-SERVER through REST APIs and real-time Socket.IO connections.

<p align="left">
  <a href="https://github.com/midhunkalarikkal/pixster-client">
    <img src="https://img.shields.io/badge/View_Pixster_Client-181717?style=for-the-badge&logo=github&logoColor=white" alt="View Pixster Client" />
  </a>
</p>

---

## Contribution

This repository is currently **not accepting contributions**.

The project is maintained as a personal portfolio and educational project.

---

## License

**Proprietary**

This project is proprietary and provided for portfolio and educational viewing purposes only.

All rights reserved.
