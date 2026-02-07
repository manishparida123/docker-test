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