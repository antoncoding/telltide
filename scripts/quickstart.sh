#!/bin/bash

set -e

echo "🌊 TellTide Quick Start"
echo "======================="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker is not running. Please start Docker first."
  exit 1
fi

echo "✅ Docker is running"

# Start PostgreSQL
echo ""
echo "📦 Starting PostgreSQL..."
docker compose up -d

echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 3

# Check PostgreSQL health
until docker exec telltide-postgres pg_isready -U postgres > /dev/null 2>&1; do
  echo "   Still waiting..."
  sleep 2
done

echo "✅ PostgreSQL is ready"

# Run migrations
echo ""
echo "🔨 Running database migrations..."
pnpm db:migrate

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Start the indexer: pnpm indexer"
echo "   2. Start the worker:  pnpm worker"
echo "   3. Start the API:     pnpm api"
echo ""
echo "   Or start everything: pnpm dev"
echo ""
echo "📚 Documentation:"
echo "   - README.md for full documentation"
echo "   - EXAMPLES.md for usage examples"
echo ""
