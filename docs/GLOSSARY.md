# Glossary

This glossary defines key terms and concepts used in NaijaTaste AI.

## General Terms

### NaijaTaste AI
A Nigerian restaurant discovery platform that uses AI to provide personalized restaurant recommendations based on user preferences, location, and budget.

### Beta
A pre-release version of the application used for testing and feedback before the official launch.

### Production
The live, publicly accessible version of the application that real users interact with.

### Development
The environment used by developers to build and test new features before deployment.

## Technical Terms

### API (Application Programming Interface)
A set of rules and definitions that allows different software applications to communicate with each other.

### REST API
A web API that follows REST (Representational State Transfer) architectural style, using HTTP methods to perform CRUD operations.

### JWT (JSON Web Token)
A compact, URL-safe means of representing claims to be transferred between two parties.

### OAuth 2.0
An authorization framework that enables applications to obtain limited access to user accounts on an HTTP service.

### CORS (Cross-Origin Resource Sharing)
A mechanism that allows restricted resources on a web page to be requested from another domain outside the domain from which the first resource was served.

### SSL/TLS (Secure Sockets Layer/Transport Layer Security)
Protocols for securing communications over computer networks, commonly used for HTTPS.

### PWA (Progressive Web App)
Web applications that use modern web capabilities to deliver an app-like experience to users.

### CDN (Content Delivery Network)
A distributed network of servers that delivers web content to users based on their geographic location.

### Database
An organized collection of structured information, or data, typically stored electronically in a computer system.

### PostgreSQL
A powerful, open source object-relational database system.

### pg-mem
An in-memory PostgreSQL implementation used for testing during development.

### ORM (Object-Relational Mapping)
A programming technique for converting data between incompatible type systems in object-oriented programming languages.

### SQL (Structured Query Language)
A domain-specific language used in programming and designed for managing data held in a relational database management system.

### Index
A data structure that improves the speed of data retrieval operations on a database table.

### Connection Pool
A cache of database connections maintained so that the connections can be reused.

## AI and Machine Learning Terms

### AI (Artificial Intelligence)
The simulation of human intelligence processes by machines, especially computer systems.

### LLM (Large Language Model)
A type of artificial intelligence model designed to understand and generate human-like text.

### Gemini
Google's AI model used in NaijaTaste AI for natural language processing and content generation.

### ReAct (Reasoning and Acting)
A framework that combines reasoning and action in AI systems to solve complex problems.

### Prompt
The input given to an AI model to generate a response.

### Token
A unit of text that an AI model processes, which can be a word, part of a word, or character.

### Context Window
The maximum amount of text that an AI model can consider at one time when generating a response.

### Fine-tuning
The process of training a pre-trained model on a specific dataset to adapt it for a particular task.

### Embedding
A representation of data (like words or phrases) as vectors in a continuous vector space.

### Vector Database
A database designed to store and query high-dimensional vectors efficiently.

### Natural Language Processing (NLP)
A branch of AI that helps computers understand, interpret, and generate human language.

### Sentiment Analysis
The process of determining the emotional tone behind a series of words.

### Named Entity Recognition (NER)
The process of identifying and categorizing key information (entities) in text.

## Frontend Terms

### React
A JavaScript library for building user interfaces, particularly single-page applications.

### Component
A reusable, self-contained piece of UI in React.

### JSX
A syntax extension for JavaScript that allows writing HTML-like code in JavaScript.

### Hook
A function that lets you use state and other React features in functional components.

### State
The data that a component manages and can change over time.

### Props
Short for "properties," props are how data flows from parent to child components in React.

### Virtual DOM
A programming concept where a virtual representation of the UI is kept in memory and synced with the real DOM by a library like React.

### Bundle
The compiled JavaScript, CSS, and other assets that are served to the browser.

### Hot Module Replacement (HMR)
A technique that allows updating modules without a full page reload.

### Lazy Loading
A technique that defers loading of non-critical resources until they are needed.

### Service Worker
A script that the browser runs in the background, separate of a web page, that enables the creation of effective offline experiences.

### Manifest
A JSON file that provides information about a web application and how it should behave when installed on a user's device.

## Backend Terms

### Express
A minimal and flexible Node.js web application framework that provides a robust set of features for web and mobile applications.

### Middleware
Functions that have access to the request (req), response (res), and the next function in the application's request-response cycle.

### Route
The part of a URL that determines which page is shown, like the product page or the contact page.

### Controller
A function that handles incoming requests and sends responses.

### Model
A representation of data and business logic in the application.

### Service
A layer that contains business logic and coordinates between models and controllers.

### Middleware Chain
A sequence of middleware functions that execute in order for each request.

### Request
An HTTP message sent from the client to the server.

### Response
An HTTP message sent from the server to the client.

### Status Code
A three-digit number that indicates the result of an HTTP request.

### Endpoint
A specific URL where an API can be accessed by a client application.

### Handler
A function that processes an API request and returns a response.

### Authentication
The process of verifying the identity of a user or system.

### Authorization
The process of determining whether a user has permission to access a resource or perform an action.

### Session
A period of interaction between a user and a web application.

### Cookie
A small piece of data stored on the client's computer by the web browser.

### Rate Limiting
A technique to limit the number of requests a client can make to an API in a given time period.

### Throttling
A technique to limit the rate at which a user can make requests to an API.

### Caching
The process of storing frequently accessed data in a temporary storage location for faster access.

## Database Terms

### Schema
The structure of a database, including tables, columns, relationships, and constraints.

### Table
A collection of related data entries consisting of columns and rows.

### Column
A vertical entity in a table that contains all the information associated with a specific field in a table.

### Row
A horizontal entity in a table that contains all the information associated with a specific record.

### Primary Key
A column or set of columns that uniquely identifies each row in a table.

### Foreign Key
A column or set of columns in one table that refers to the primary key in another table.

### Index
A data structure that improves the speed of data retrieval operations on a database table.

### Query
A request for data from a database.

### Join
A method of combining data from two or more tables based on related columns.

### Migration
A file that contains instructions for changing the database schema.

### Transaction
A sequence of operations performed as a single logical unit of work.

### ACID
Properties that guarantee database transactions are processed reliably: Atomicity, Consistency, Isolation, Durability.

### Normalization
The process of organizing data in a database to reduce redundancy and improve data integrity.

### Denormalization
The process of adding redundant data to one or more tables to optimize read performance.

## Testing Terms

### Unit Test
A test that verifies a small, isolated piece of code (a unit) works correctly.

### Integration Test
A test that verifies different parts of the system work together correctly.

### End-to-End Test
A test that verifies the entire application flow from start to finish.

### Test Coverage
The percentage of code that is covered by tests.

### Mock
A simulated object that mimics the behavior of a real object in a controlled way.

### Stub
A simplified implementation of a component that provides predefined responses.

### Fixture
A fixed state of the system used as a baseline for running tests.

### Test Runner
A tool that executes tests and reports the results.

### Assertion
A statement that checks if a condition is true; if not, the test fails.

### Test Suite
A collection of related tests.

### Test Case
A set of conditions or variables under which a tester will determine whether a system under test satisfies requirements or works correctly.

## Security Terms

### Vulnerability
A weakness in a system that can be exploited by an attacker.

### Exploit
A technique or tool used to take advantage of a vulnerability.

### Injection
An attack where malicious data is sent to an application to manipulate its behavior.

### XSS (Cross-Site Scripting)
An attack where malicious scripts are injected into web pages viewed by other users.

### CSRF (Cross-Site Request Forgery)
An attack that forces an end user to execute unwanted actions on a web application in which they're authenticated.

### SQL Injection
An attack that makes it possible to execute malicious SQL statements.

### DDoS (Distributed Denial of Service)
An attack that attempts to make a service unavailable by overwhelming it with traffic from multiple sources.

### Brute Force
A trial-and-error method used to obtain information such as a user password.

### Salt
A random data that is used as an additional input to a one-way function that hashes data.

### Hash
A function that converts an input of arbitrary length into a fixed-size string.

### Encryption
The process of converting information or data into a code to prevent unauthorized access.

### Decryption
The process of converting encrypted data back to its original form.

### Certificate
A digital document that verifies the ownership of a public key.

### Firewall
A network security system that monitors and controls incoming and outgoing network traffic.

## Performance Terms

### Latency
The time taken to process a single operation.

### Throughput
The number of operations that can be processed in a given time period.

### Response Time
The time taken for a system to respond to a request.

### Bottleneck
A point in the system that limits the overall performance.

### Load Balancing
The process of distributing incoming network traffic across multiple servers.

### Caching
The process of storing frequently accessed data in a temporary storage location.

### CDN (Content Delivery Network)
A distributed network of servers that delivers web content to users based on their geographic location.

### Compression
The process of reducing the size of data to save bandwidth and improve loading times.

### Minification
The process of removing unnecessary characters from code to reduce its size.

### Bundle Splitting
The process of splitting code into multiple bundles to improve loading performance.

### Lazy Loading
A technique that defers loading of non-critical resources until they are needed.

## Business Terms

### MVP (Minimum Viable Product)
A version of a product with just enough features to be viable for early adopters.

### KPI (Key Performance Indicator)
A measurable value that demonstrates how effectively a company is achieving key business objectives.

### Conversion Rate
The percentage of users who take a desired action.

### Churn Rate
The percentage of customers who stop using a service over a given period.

### Retention Rate
The percentage of customers who continue to use a service over a given period.

### Acquisition Cost
The cost associated with acquiring a new customer.

### Lifetime Value (LTV)
The total revenue a business can expect from a single customer account.

### ROI (Return on Investment)
A measure used to evaluate the efficiency of an investment.

### A/B Testing
A method of comparing two versions of a webpage or app against each other to determine which one performs better.

### User Journey
The path a user takes to accomplish a goal within a product or service.

### User Experience (UX)
The overall experience a user has when interacting with a product or service.

### User Interface (UI)
The point of interaction between a user and a computer program.

### Onboarding
The process of guiding new users through the features and functionality of a product.

### Engagement
The level of interaction and involvement users have with a product or service.

### Monetization
The process of generating revenue from a product or service.

### Partnership
A relationship between two or more parties that collaborate to achieve common goals.

### Market Penetration
 the extent to which a product or service is available to and used by customers in a market.

## Nigerian Context Terms

### Jollof Rice
A popular Nigerian rice dish, considered a national dish in many West African countries.

### Eba
A Nigerian food made from cassava flour, often served with soups.

### Amala
A Nigerian food made from yam or cassava flour, popular in the southwestern part of Nigeria.

### Suya
A spicy Nigerian meat skewer, a popular street food.

### Moi Moi
A Nigerian steamed bean pudding, often served with jollof rice.

### Akara
A Nigerian bean cake, often eaten for breakfast.

### Pounded Yam
A Nigerian food made from yam, pounded into a smooth paste.

### Egusi Soup
A Nigerian soup made from ground melon seeds.

### Ogbono Soup
A Nigerian soup made from ground ogbono seeds.

### Afang Soup
A Nigerian soup made from afang leaves and other ingredients.

### Banga Soup
A Nigerian soup made from palm nut fruit.

### Asaro
A Nigerian yam porridge, often served with stew.

### Efo Riro
A Nigerian vegetable soup.

### Gbegiri
A Nigerian bean soup.

### Moin Moin
A Nigerian steamed bean pudding.

### Pounded Yam
A Nigerian food made from yam, pounded into a smooth paste.

### Suya Spice
A spice mix used to make suya, typically containing groundnuts, ginger, and other spices.

### Yaji
A spice mix used in Nigerian cuisine, typically containing ginger, garlic, and other spices.

### Zobo
A Nigerian beverage made from hibiscus flowers.

### Kunu
A Nigerian beverage made from millet or maize.

### Palm Wine
A traditional alcoholic beverage made from the sap of various species of palm tree.

## Contributing to Glossary

To contribute new terms or definitions:

1. Check if the term already exists
2. Follow the existing format and structure
3. Provide clear, concise definitions
4. Include examples where helpful
5. Submit a pull request with your changes

## Support

For questions about terms in this glossary or to suggest additions:

1. Check the [GitHub Issues](https://github.com/hiamrhex/naijaste-ai/issues)
2. Search existing issues before creating new ones
3. Create a new issue with the term and suggested definition
4. Include context about why the term is important

---

This glossary is a living document that will be updated regularly as the project evolves and new terms are introduced.