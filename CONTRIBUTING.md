# Contributing to Logistics Aggregator Portal

Thank you for your interest in contributing to the Logistics Aggregator Portal! This document provides guidelines and information for contributors to ensure a smooth and consistent development experience.

## 🎯 **Quick Start for Contributors**

### **Before You Start**

1. **Read the Documentation**:
   - [Project Overview](./wiki/README.md) - Understanding the project
   - [Quick Start Guide](./wiki/Quick-Start-Guide.md) - 10-minute setup
   - [Architecture Overview](./memory-bank/systemPatterns.md) - Technical foundation

2. **Choose Your Track**:
   - **Frontend Developer**: [Frontend Development Guide](./docs/FRONTEND-DEVELOPMENT-GUIDE.md)
   - **Backend Developer**: [Backend Development Guide](./docs/BACKEND-DEVELOPMENT-GUIDE.md)

3. **Set Up Your Environment**:
   ```bash
   git clone <repository-url>
   cd logistics
   docker-compose up
   ```

## 📋 **Development Process**

### **1. Issue Selection and Assignment**

#### **Finding Work**

- **Check Current Priorities**: Review [Active Context](./memory-bank/activeContext.md) for current focus
- **Browse Issues**: Look for issues labeled `good-first-issue` or `help-wanted`
- **Weekly Priorities**: Check Week 2 tasks in development guides
- **Team Coordination**: Coordinate with team leads for task assignment

#### **Issue Assignment Process**

1. **Comment on Issue**: Express interest and ask for assignment
2. **Wait for Confirmation**: Team lead will assign and provide context
3. **Understand Requirements**: Read issue description and acceptance criteria
4. **Ask Questions**: Clarify any ambiguities before starting

### **2. Development Workflow**

#### **Branch Creation**

```bash
# Create feature branch from main
git checkout main
git pull origin main
git checkout -b feature/issue-number-brief-description

# Examples:
git checkout -b feature/123-user-profile-management
git checkout -b feature/456-login-form-validation
git checkout -b fix/789-auth-token-refresh
```

#### **Development Standards**

**Frontend Development:**

- **Framework**: Next.js 14 with TypeScript and Tailwind CSS
- **State Management**: Zustand for global state
- **Forms**: React Hook Form with Zod validation
- **API Integration**: Axios with JWT interceptors
- **Testing**: Jest with React Testing Library

**Backend Development:**

- **CRITICAL**: Always use Prisma ORM - **NEVER write raw SQL**
- **Framework**: Node.js with Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT with role-based access control
- **Validation**: Joi-based schema validation
- **Testing**: Jest with Supertest for API testing

#### **Code Quality Requirements**

```javascript
// Backend: Always use Prisma patterns
const user = await prisma.user.create({
  data: { email, name, role },
  select: { id: true, email: true, name: true }
});

// Frontend: Always use TypeScript
interface UserProfileProps {
  user: User;
  onUpdate: (user: User) => void;
}

export default function UserProfile({ user, onUpdate }: UserProfileProps) {
  // Component implementation
}
```

### **3. Commit Guidelines**

#### **Commit Message Format**

Follow [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

#### **Commit Types**

- **feat**: New feature implementation
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, etc.)
- **refactor**: Code refactoring without functionality changes
- **test**: Adding or updating tests
- **chore**: Build process, dependency updates, etc.

#### **Examples**

```bash
# Feature implementation
git commit -m "feat(auth): implement user registration form with validation"

# Bug fix
git commit -m "fix(api): resolve JWT token refresh issue"

# Documentation
git commit -m "docs: update backend development guide with Prisma patterns"

# Database changes
git commit -m "feat(database): add user profile schema with audit logging"
```

### **4. Pull Request Process**

#### **Before Creating PR**

```bash
# Ensure code quality
yarn run lint              # Fix linting issues
yarn run type-check        # Fix TypeScript errors
yarn test                  # Ensure all tests pass

# For backend changes with Prisma:
npx prisma generate       # Update Prisma client
npx prisma migrate dev    # Ensure migrations work
```

#### **PR Creation Checklist**

- [ ] **Branch Updated**: Merged latest `main` into feature branch
- [ ] **Tests Pass**: All existing tests pass
- [ ] **Code Quality**: No linting or TypeScript errors
- [ ] **Documentation**: Updated relevant documentation
- [ ] **Prisma Changes**: Generated client and tested migrations (if applicable)
- [ ] **API Documentation**: Updated if API changes were made

#### **PR Description Template**

```markdown
## Summary

Brief description of changes and motivation.

## Changes Made

- [ ] Feature/fix implementation
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] Database schema changes (if applicable)

## Testing

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] API endpoints tested (if applicable)

## Breaking Changes

List any breaking changes and migration instructions.

## Screenshots/Demos

Include screenshots for UI changes or API response examples.

## Related Issues

Closes #123, Relates to #456
```

#### **Review Process**

1. **Automated Checks**: GitHub Actions will run tests and linting
2. **Code Review**: Team members will review code quality and architecture
3. **Testing**: Reviewers may test functionality locally
4. **Approval**: Requires at least one approval from team lead
5. **Merge**: Squash and merge after approval

## 🎨 **Code Style and Standards**

### **General Guidelines**

- **Consistency**: Follow existing code patterns in the project
- **Readability**: Write self-documenting code with clear variable names
- **Comments**: Explain complex business logic, not obvious code
- **Error Handling**: Always handle errors appropriately
- **Security**: Follow security best practices for authentication and data handling

### **JavaScript/TypeScript**

```javascript
// Use descriptive variable names
const authenticatedUser = await validateJWT(token);

// Prefer const over let, never use var
const userProfile = await prisma.user.findUnique({ where: { id } });

// Use async/await over promises
const createUser = async (userData) => {
  try {
    const user = await prisma.user.create({ data: userData });
    return user;
  } catch (error) {
    logger.error("User creation failed:", error);
    throw new APIError("Failed to create user");
  }
};
```

### **React Components**

```typescript
// Use TypeScript interfaces
interface ComponentProps {
  user: User;
  onUpdate: (user: User) => void;
}

// Prefer function components with hooks
export default function UserCard({ user, onUpdate }: ComponentProps) {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (formData: UserFormData) => {
    setLoading(true);
    try {
      await updateUser(user.id, formData);
      onUpdate({ ...user, ...formData });
    } catch (error) {
      // Handle error
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {/* Component JSX */}
    </div>
  );
}
```

### **Database Operations (Prisma)**

```javascript
// Always use Prisma for database operations
const getUserWithProfile = async (userId) => {
  return await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: true,
      auditLogs: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });
};

// Use transactions for complex operations
const updateUserWithAudit = async (userId, updateData, req) => {
  return await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: updateData,
    });

    await tx.auditLog.create({
      data: {
        userId: req.user.id,
        action: "UPDATE",
        resource: "user",
        resourceId: userId,
        changes: updateData,
        ipAddress: req.ip,
      },
    });

    return user;
  });
};
```

## 🧪 **Testing Guidelines**

### **Testing Strategy**

- **Unit Tests**: Test individual functions and components
- **Integration Tests**: Test API endpoints and database operations
- **E2E Tests**: Test complete user workflows (critical paths)

### **Backend Testing**

```javascript
// API endpoint testing
describe("User API", () => {
  test("should create user with valid data", async () => {
    const userData = {
      email: "test@example.com",
      name: "Test User",
      role: "CLIENT",
    };

    const response = await request(app)
      .post("/api/v1/users")
      .send(userData)
      .expect(201);

    expect(response.body.status).toBe("success");
    expect(response.body.data.user.email).toBe(userData.email);
  });
});

// Database testing with Prisma
describe("User Service", () => {
  beforeEach(async () => {
    await prisma.user.deleteMany(); // Clean test database
  });

  test("should create user with audit log", async () => {
    const user = await createUser(userData);
    const auditLogs = await prisma.auditLog.findMany({
      where: { resourceId: user.id },
    });

    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0].action).toBe("CREATE");
  });
});
```

### **Frontend Testing**

```typescript
// Component testing
test('renders user profile form', () => {
  const mockUser = { id: '1', name: 'Test User', email: 'test@example.com' };

  render(<UserProfileForm user={mockUser} onUpdate={jest.fn()} />);

  expect(screen.getByDisplayValue(mockUser.name)).toBeInTheDocument();
  expect(screen.getByDisplayValue(mockUser.email)).toBeInTheDocument();
});

// API integration testing with MSW
test('submits user profile update', async () => {
  server.use(
    rest.put('/api/v1/users/profile', (req, res, ctx) => {
      return res(ctx.json({ status: 'success', data: { user: updatedUser } }));
    })
  );

  // Test component behavior with mocked API
});
```

## 📝 **Documentation Requirements**

### **Code Documentation**

```javascript
/**
 * Creates a new user with the provided data and logs the action.
 *
 * @param {Object} userData - User creation data
 * @param {string} userData.email - User email address
 * @param {string} userData.name - User full name
 * @param {string} userData.role - User role (ADMIN, CLIENT, etc.)
 * @param {Object} req - Express request object for audit logging
 * @returns {Promise<User>} Created user object
 * @throws {ValidationError} When userData is invalid
 * @throws {ConflictError} When email already exists
 */
const createUser = async (userData, req) => {
  // Implementation
};
```

### **API Documentation**

When adding new API endpoints, update `/docs/API-Specifications.md`:

````markdown
### Create User

**Endpoint:** `POST /api/v1/users`  
**Authentication:** Required (Admin only)

**Request Body:**

```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "role": "CLIENT"
}
```
````

**Response (201):**

```json
{
  "status": "success",
  "message": "User created successfully",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "CLIENT",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  }
}
```

````

### **README Updates**
Update relevant README sections when:
- Adding new services or major features
- Changing development workflow
- Updating dependencies or requirements
- Modifying Docker configuration

## 🔒 **Security Guidelines**

### **Authentication & Authorization**
```javascript
// Always verify JWT tokens
const authenticateUser = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Access denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Check user permissions
const requireRole = (roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};
````

### **Data Validation**

```javascript
// Always validate input data
const userValidationSchema = Joi.object({
  email: Joi.string().email().required(),
  name: Joi.string().min(2).max(100).required(),
  role: Joi.string().valid(
    "ADMIN",
    "CLIENT",
    "FINANCE",
    "OPERATIONS",
    "SUPPORT",
  ),
});

const validateUserData = (req, res, next) => {
  const { error, value } = userValidationSchema.validate(req.body);
  if (error) {
    return res
      .status(400)
      .json({ error: "Validation failed", details: error.details });
  }
  req.body = value;
  next();
};
```

### **Sensitive Data Handling**

- **Never log passwords** or sensitive information
- **Always hash passwords** using bcrypt with 12+ rounds
- **Use environment variables** for secrets and API keys
- **Sanitize input data** to prevent XSS attacks
- **Use HTTPS** in production environments

## 🚨 **Common Issues and Solutions**

### **Prisma Issues**

```bash
# Schema changes not reflected
npx prisma generate

# Migration conflicts
npx prisma migrate reset  # Development only!

# Database connection issues
# Check DATABASE_URL in .env file
```

### **Docker Issues**

```bash
# Port conflicts
docker-compose down
sudo lsof -i :3000  # Check what's using the port

# Service won't start
docker-compose logs service-name

# Clear cache and rebuild
docker-compose down
docker system prune -f
docker-compose up --build
```

### **Git Issues**

```bash
# Merge conflicts
git status
git add .
git commit -m "resolve merge conflicts"

# Accidental commit to main
git checkout main
git reset --hard HEAD~1  # Undo last commit (if not pushed)

# Update feature branch with latest main
git checkout feature-branch
git merge main
```

## 📞 **Getting Help**

### **Development Questions**

1. **Check Documentation**: Review relevant guides and wiki pages
2. **Search Issues**: Look for existing GitHub issues
3. **Ask Team**: Post in team communication channels
4. **Create Issue**: Open GitHub issue for bugs or feature requests

### **Code Review Feedback**

- **Be Open**: Accept feedback positively and ask clarifying questions
- **Explain Decisions**: Provide context for your implementation choices
- **Address Comments**: Respond to all review comments before re-requesting review
- **Learn and Improve**: Use feedback to improve your skills

### **Resources**

- **Project Wiki**: [./wiki/README.md](./wiki/README.md)
- **Memory Bank**: [./memory-bank/](./memory-bank/) - Complete project context
- **Development Guides**: [./docs/](./docs/) - Detailed development instructions
- **API Documentation**: [./docs/API-Specifications.md](./docs/API-Specifications.md)

## 🎯 **Current Contribution Opportunities**

### **High Priority (Week 2)**

- **User Service Development**: Prisma schema design and API implementation
- **Frontend Authentication**: Login/register forms and state management
- **Service Integration**: Connect frontend to backend APIs
- **Documentation**: Update API specifications and guides

### **Medium Priority**

- **Testing**: Add unit and integration tests
- **UI Components**: Reusable component library development
- **Error Handling**: Improve error messages and user feedback
- **Performance**: Optimize database queries and API responses

### **Good First Issues**

- **Documentation Improvements**: Fix typos, add examples, improve clarity
- **UI Enhancements**: Improve styling, add loading states, enhance UX
- **Validation Messages**: Improve form validation feedback
- **Testing**: Add test coverage for existing functionality

## 👥 **Community**

### **Code of Conduct**

- **Be Respectful**: Treat all contributors with respect and professionalism
- **Be Collaborative**: Work together to achieve project goals
- **Be Constructive**: Provide helpful feedback and suggestions
- **Be Patient**: Support new contributors and help them learn

### **Recognition**

Contributors will be recognized in:

- **CHANGELOG.md**: Major contributions documented in release notes
- **README.md**: Contributor acknowledgments section
- **GitHub**: Contribution history and statistics
- **Team Meetings**: Recognition in team updates and retrospectives

---

## 🎉 **Thank You for Contributing!**

Your contributions make this project better for everyone. Whether you're fixing bugs, adding features, improving documentation, or helping other contributors, your efforts are valued and appreciated.

**Questions?** Don't hesitate to ask! We're here to help you succeed and make meaningful contributions to the Logistics Aggregator Portal.

---

**Contributing Status**: ✅ **Active and Welcoming**  
**Last Updated**: January 2024  
**Maintainers**: Development Team  
**Response Time**: 24-48 hours for questions and PR reviews
