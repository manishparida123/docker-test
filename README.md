# Jenkins Docker Setup Guide
## Running Jenkins in Docker Desktop on MacBook

This guide shows you how to run Jenkins as a Docker container on your Mac, which is the modern, industry-standard approach.

## Why Jenkins in Docker?

✅ **Isolated environment** - No pollution of your Mac's system
✅ **Easy cleanup** - Just remove the container
✅ **Consistent setup** - Same environment everywhere
✅ **Easy upgrades** - Pull new image and restart
✅ **Real-world practice** - This is how companies run Jenkins

---

## Step 1: Prepare Docker Desktop

Make sure Docker Desktop is running on your Mac:
```bash
# Check Docker is running
docker --version
docker ps
```

---

## Step 2: Create Jenkins Home Directory

Create a persistent volume for Jenkins data:
```bash
# Create directory for Jenkins data
mkdir -p ~/jenkins_home

# Set proper permissions (Jenkins runs as user 1000)
chmod -R 777 ~/jenkins_home
```

This directory will store:
- Jenkins configurations
- Installed plugins
- Job definitions
- Build history
- Credentials

---

## Step 3: Run Jenkins Container

### Option A: Simple Quick Start
```bash
docker run -d \
  --name jenkins \
  -p 8080:8080 \
  -p 50000:50000 \
  -v ~/jenkins_home:/var/jenkins_home \
  jenkins/jenkins:lts
```

### Option B: Production-Ready Setup (Recommended)
```bash
docker run -d \
  --name jenkins \
  -p 8080:8080 \
  -p 50000:50000 \
  -v ~/jenkins_home:/var/jenkins_home \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v $(which docker):/usr/bin/docker \
  -e JAVA_OPTS="-Djenkins.install.runSetupWizard=false" \
  --restart unless-stopped \
  jenkins/jenkins:lts
```

**What each flag does:**
- `-d` - Run in detached mode (background)
- `--name jenkins` - Name the container "jenkins"
- `-p 8080:8080` - Jenkins web UI port
- `-p 50000:50000` - Jenkins agent communication port
- `-v ~/jenkins_home:/var/jenkins_home` - Persist Jenkins data
- `-v /var/run/docker.sock:/var/run/docker.sock` - Allow Jenkins to use Docker (Docker-in-Docker)
- `--restart unless-stopped` - Auto-restart on system reboot

---

## Step 4: Access Jenkins

1. **Get initial admin password:**
```bash
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

2. **Open Jenkins in browser:**
```
http://localhost:8080
```

3. **Complete setup wizard:**
   - Paste the initial admin password
   - Click "Install suggested plugins"
   - Create your first admin user
   - Keep default Jenkins URL: `http://localhost:8080/`

---

## Step 5: Install Required Plugins

After initial setup, install these plugins:

### Navigate to: Manage Jenkins → Plugins → Available Plugins

**Essential Plugins:**
- [ ] **Docker Pipeline** - Build and push Docker images
- [ ] **Amazon ECR** - Push images to AWS ECR
- [ ] **Kubernetes** - Deploy to Kubernetes
- [ ] **Kubernetes CLI** - Run kubectl commands
- [ ] **Git** - Git integration (usually pre-installed)
- [ ] **Pipeline** - Pipeline as code (usually pre-installed)
- [ ] **Blue Ocean** - Modern UI (optional but beautiful)
- [ ] **GitHub** - GitHub integration
- [ ] **Credentials Binding** - Secure credential handling

---

## Step 6: Configure AWS Credentials

### Add AWS Credentials to Jenkins:

1. Go to: **Manage Jenkins → Credentials → System → Global credentials → Add Credentials**

2. Add AWS Access Key:
   - Kind: **Secret text** or **AWS Credentials**
   - ID: `aws-credentials`
   - Description: `AWS Access for ECR`
   - Access Key ID: Your AWS access key
   - Secret Access Key: Your AWS secret key

---

## Step 7: Configure Docker in Jenkins

Since we're running Jenkins in Docker, we need to enable Docker-in-Docker (DinD).

### Create Custom Jenkins Image with Docker:

Create a file: `Dockerfile.jenkins`
```dockerfile
FROM jenkins/jenkins:lts

USER root

# Install Docker CLI
RUN apt-get update && \
    apt-get -y install apt-transport-https ca-certificates curl gnupg2 software-properties-common && \
    curl -fsSL https://download.docker.com/linux/debian/gpg | apt-key add - && \
    add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/debian $(lsb_release -cs) stable" && \
    apt-get update && \
    apt-get -y install docker-ce-cli

# Install kubectl
RUN curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" && \
    chmod +x kubectl && \
    mv kubectl /usr/local/bin/

# Install AWS CLI
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" && \
    unzip awscliv2.zip && \
    ./aws/install && \
    rm -rf awscliv2.zip aws

# Install Helm
RUN curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

USER jenkins
```

### Build and Run Custom Jenkins:
```bash
# Build the custom Jenkins image
docker build -t jenkins-custom -f Dockerfile.jenkins .

# Stop and remove old Jenkins container
docker stop jenkins
docker rm jenkins

# Run new custom Jenkins
docker run -d \
  --name jenkins \
  -p 8080:8080 \
  -p 50000:50000 \
  -v ~/jenkins_home:/var/jenkins_home \
  -v /var/run/docker.sock:/var/run/docker.sock \
  --group-add $(stat -f '%g' /var/run/docker.sock) \
  --restart unless-stopped \
  jenkins-custom
```

---

## Step 8: Configure kubectl for EKS

After your EKS cluster is created (Phase 5), configure kubectl access in Jenkins:

```bash
# Get your kubeconfig from your Mac
aws eks update-kubeconfig --name task-manager-cluster --region us-east-1

# Copy kubeconfig to Jenkins
docker cp ~/.kube/config jenkins:/var/jenkins_home/.kube/config

# Or exec into Jenkins and configure
docker exec -it jenkins bash
aws eks update-kubeconfig --name task-manager-cluster --region us-east-1
```

---

## Step 9: Test Jenkins Setup

### Create a test pipeline to verify everything works:

1. **New Item → Pipeline**
2. **Name:** `test-setup`
3. **Pipeline Script:**

```groovy
pipeline {
    agent any
    
    stages {
        stage('Test Docker') {
            steps {
                sh 'docker --version'
            }
        }
        
        stage('Test AWS CLI') {
            steps {
                sh 'aws --version'
            }
        }
        
        stage('Test kubectl') {
            steps {
                sh 'kubectl version --client'
            }
        }
        
        stage('Test Helm') {
            steps {
                sh 'helm version'
            }
        }
    }
}
```

---

## Useful Jenkins Commands

```bash
# View Jenkins logs
docker logs jenkins

# Follow logs in real-time
docker logs -f jenkins

# Restart Jenkins
docker restart jenkins

# Stop Jenkins
docker stop jenkins

# Start Jenkins
docker start jenkins

# Access Jenkins container shell
docker exec -it jenkins bash

# Backup Jenkins data
tar -czf jenkins_backup_$(date +%Y%m%d).tar.gz ~/jenkins_home

# Remove Jenkins completely
docker stop jenkins
docker rm jenkins
rm -rf ~/jenkins_home  # Warning: This deletes all Jenkins data!
```

---

## Docker Compose for Jenkins (Alternative)

For easier management, create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  jenkins:
    build:
      context: .
      dockerfile: Dockerfile.jenkins
    container_name: jenkins
    privileged: true
    user: root
    ports:
      - "8080:8080"
      - "50000:50000"
    volumes:
      - ~/jenkins_home:/var/jenkins_home
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - JAVA_OPTS=-Djenkins.install.runSetupWizard=false
    restart: unless-stopped
```

**Usage:**
```bash
# Start Jenkins
docker-compose up -d

# View logs
docker-compose logs -f

# Stop Jenkins
docker-compose down

# Stop and remove volumes (complete cleanup)
docker-compose down -v
```

---

## Troubleshooting

### Issue: Permission Denied for Docker Socket
```bash
# Add jenkins user to docker group in container
docker exec -u root jenkins chmod 666 /var/run/docker.sock
```

### Issue: Cannot connect to EKS
```bash
# Verify kubeconfig exists
docker exec jenkins cat /var/jenkins_home/.kube/config

# Test kubectl access
docker exec jenkins kubectl get nodes
```

### Issue: AWS credentials not working
```bash
# Configure AWS credentials in container
docker exec -it jenkins bash
aws configure
```

### Issue: Jenkins runs out of memory
```bash
# Increase Java heap size
docker run -d \
  --name jenkins \
  -p 8080:8080 \
  -e JAVA_OPTS="-Xmx2048m -Xms1024m" \
  ...
```

---

## Next Steps

Once Jenkins is running:
1. ✅ Install required plugins
2. ✅ Configure AWS credentials
3. ✅ Configure GitHub webhook
4. ✅ Create your first pipeline (Phase 6)
5. ✅ Automate Docker builds
6. ✅ Deploy to EKS

---

## Pro Tips

💡 **Use Jenkins Pipeline** - Write Jenkinsfile and commit it to your repo
💡 **Enable Blue Ocean** - Much nicer UI for visualizing pipelines
💡 **Regular Backups** - Backup ~/jenkins_home regularly
💡 **Use Shared Libraries** - Reuse pipeline code across projects
💡 **Security** - Don't expose Jenkins to internet, use ngrok for webhooks if needed

---

## What's Different from Installing on Mac Directly?

| Aspect | Docker Jenkins | Direct Install |
|--------|---------------|----------------|
| **Cleanup** | `docker rm jenkins` | Uninstall, remove configs manually |
| **Isolation** | Fully isolated | Pollutes system |
| **Upgrades** | Pull new image | Reinstall |
| **Portability** | Works anywhere | Mac-specific |
| **Multi-version** | Run multiple Jenkins | Complex |
| **Industry Practice** | ✅ Standard | ❌ Rare |

---

This is the **production-ready way** to run Jenkins! 🚀

# 🚀 Phase 1: Complete Setup Instructions

## What You'll Build

A full-stack Task Manager application with:
- **Frontend**: React (served by Nginx)
- **Backend**: Node.js/Express API
- **Database**: PostgreSQL
- **Cache**: Redis

All running in Docker containers, orchestrated by Docker Compose!

---

## Step-by-Step Setup

### Step 1: Create Project Directory

```bash
mkdir -p ~/task-manager-k8s && cd ~/task-manager-k8s
```

### Step 2: Create Backend Files

Create the backend directory and files:

```bash
mkdir -p backend && cd backend
```

**File: `backend/package.json`**
(Use the content from backend-package.json I provided)

**File: `backend/server.js`**
(Use the content from backend-server.js I provided)

**File: `backend/Dockerfile`**
(Use the content from backend-Dockerfile I provided)

**File: `backend/.env`** (optional, for local development)
```bash
PORT=3000
DB_HOST=postgres
DB_USER=taskuser
DB_PASSWORD=taskpass
DB_NAME=taskdb
REDIS_HOST=redis
NODE_ENV=development
```

### Step 3: Create Frontend Files

```bash
cd ~/task-manager-k8s
mkdir -p frontend/public frontend/src && cd frontend
```

**File: `frontend/package.json`**
(Use the content from frontend-package.json I provided)

**File: `frontend/public/index.html`**
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="Task Manager - Cloud Native Learning Project" />
    <title>Task Manager</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>
```

**File: `frontend/src/index.js`**
```javascript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**File: `frontend/src/App.js`**
(Use the content from frontend-App.js I provided)

**File: `frontend/src/App.css`**
(Use the content from frontend-App.css I provided)

**File: `frontend/Dockerfile`**
```dockerfile
# Build stage
FROM node:18-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built app
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

**File: `frontend/nginx.conf`**
```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # Frontend routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://backend:3000/health;
    }
}
```

### Step 4: Create Database Init Script

```bash
cd ~/task-manager-k8s
mkdir -p database/init-scripts && cd database/init-scripts
```

**File: `database/init-scripts/01-init.sql`**
```sql
-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX idx_tasks_completed ON tasks(completed);

-- Insert sample data
INSERT INTO tasks (title, description, completed) VALUES
    ('Learn Docker', 'Understand containerization and Docker basics', true),
    ('Learn Kubernetes', 'Master pod, deployment, and service concepts', false),
    ('Setup EKS Cluster', 'Create production-ready EKS cluster on AWS', false),
    ('Implement CI/CD', 'Setup Jenkins pipeline for automated deployments', false);

-- Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE
    ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Step 5: Create Docker Compose File

```bash
cd ~/task-manager-k8s
```

**File: `docker-compose.yml`**
```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: task-postgres
    environment:
      POSTGRES_DB: taskdb
      POSTGRES_USER: taskuser
      POSTGRES_PASSWORD: taskpass
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init-scripts:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U taskuser -d taskdb"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - task-network

  # Redis Cache
  redis:
    image: redis:7-alpine
    container_name: task-redis
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - task-network

  # Backend API
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: task-backend
    ports:
      - "3000:3000"
    environment:
      DB_HOST: postgres
      DB_USER: taskuser
      DB_PASSWORD: taskpass
      DB_NAME: taskdb
      REDIS_HOST: redis
      NODE_ENV: development
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - task-network
    restart: unless-stopped

  # Frontend
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: task-frontend
    ports:
      - "80:80"
    environment:
      REACT_APP_API_URL: http://localhost:3000
    depends_on:
      - backend
    networks:
      - task-network
    restart: unless-stopped

networks:
  task-network:
    driver: bridge

volumes:
  postgres_data:
```

### Step 6: Create .dockerignore Files

**File: `backend/.dockerignore`**
```
node_modules
npm-debug.log
.env
.git
.gitignore
README.md
.DS_Store
```

**File: `frontend/.dockerignore`**
```
node_modules
npm-debug.log
build
.git
.gitignore
README.md
.DS_Store
.env.local
.env.development.local
.env.test.local
.env.production.local
```

---

## Step 7: Build and Run!

```bash
# Navigate to project directory
cd ~/task-manager-k8s

# Build and start all services
docker-compose up --build -d

# Watch the logs
docker-compose logs -f
```

---

## Step 8: Test Your Application

### Check Services are Running
```bash
docker-compose ps
```

You should see 4 containers running:
- task-postgres
- task-redis
- task-backend
- task-frontend

### Test the Backend API
```bash
# Health check
curl http://localhost:3000/health

# Get all tasks
curl http://localhost:3000/api/tasks

# Create a task
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Test from CLI","description":"Testing the API"}'
```

### Test the Frontend
Open your browser:
```bash
open http://localhost
```

You should see the Task Manager UI!

---

## Step 9: Useful Commands

```bash
# View logs for all services
docker-compose logs -f

# View logs for specific service
docker-compose logs -f backend

# Stop all services
docker-compose down

# Stop and remove volumes (fresh start)
docker-compose down -v

# Restart a specific service
docker-compose restart backend

# Rebuild after code changes
docker-compose up --build -d

# Execute command in container
docker-compose exec backend sh
docker-compose exec postgres psql -U taskuser -d taskdb

# Check container resource usage
docker stats
```

---

## Step 10: Verify Everything is Working

### ✅ Checklist

- [ ] All 4 containers are running (`docker-compose ps`)
- [ ] Backend health check works (`curl http://localhost:3000/health`)
- [ ] Can fetch tasks from API (`curl http://localhost:3000/api/tasks`)
- [ ] Frontend loads in browser (`http://localhost`)
- [ ] Can create new tasks via UI
- [ ] Can mark tasks as complete
- [ ] Can delete tasks
- [ ] Cache indicator shows (Redis working)
- [ ] Stats cards update correctly

---

## Troubleshooting

### Issue: Port already in use
```bash
# Find what's using the port
lsof -i :80
lsof -i :3000

# Kill the process or change ports in docker-compose.yml
```

### Issue: Containers won't start
```bash
# Check logs
docker-compose logs

# Rebuild from scratch
docker-compose down -v
docker-compose up --build
```

### Issue: Can't connect to database
```bash
# Check if postgres is ready
docker-compose exec postgres pg_isready -U taskuser

# Connect to postgres
docker-compose exec postgres psql -U taskuser -d taskdb

# List tables
\dt
```

### Issue: Frontend can't reach backend
```bash
# Check if backend is accessible
docker-compose exec frontend curl http://backend:3000/health

# Check nginx config
docker-compose exec frontend cat /etc/nginx/conf.d/default.conf
```

---

## What You've Learned So Far

✅ **Docker Basics**
- Dockerfile syntax
- Multi-stage builds
- Base images and layers
- Build optimization

✅ **Docker Compose**
- Service orchestration
- Networking between containers
- Volume management
- Health checks
- Dependencies

✅ **Best Practices**
- Non-root users
- Health checks
- Environment variables
- .dockerignore files
- Layer caching

---
