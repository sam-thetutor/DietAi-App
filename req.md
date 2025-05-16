# DietAI Requirements Document

## 1. User Registration & Profile Setup

### 1.1 Initial Setup
- Connect Web3 wallet
- Create health profile:
  - Basic info (age, gender, height, weight)
  - Health goals (weight loss/gain/maintenance)
  - Activity level
  - Dietary restrictions/preferences
  - Daily calorie targets
  - Macro/micro nutrient goals

### 1.2 Smart Contract Integration
- Store user goals on-chain
- Initialize reward parameters
- Set daily calorie targets

## 2. Core Features

### 2.1 Food Logging System

### 2.2 AI-Powered Analysis
- Real-time food recognition
- Portion size estimation
- Nutritional content analysis
- Meal recommendations
- Pattern recognition for dietary habits

### 2.3 Progress Tracking
- Daily calorie tracking
- Macro/micronutrient monitoring
- Weight tracking
- Visual progress charts
- Achievement milestones
- Token earning history

## 3. User Flow

mermaid
graph TD
A[Open App] --> B[Connect Wallet]
B --> C[Create/Load Profile]
C --> D[Daily Activities]
D --> E[Log Food]
E --> E1[AI Camera Scan]
E --> E2[Barcode Scan]
E --> E3[Manual Entry]
D --> F[View Progress]
F --> F1[Nutrition Stats]
F --> F2[Weight Tracking]
F --> F3[Token Earnings]
D --> G[Get Recommendations]
G --> G1[Meal Suggestions]
G --> G2[Nutrition Advice]
D --> H[Claim Rewards]
H --> H1[Daily Achievements]
H --> H2[Weekly Bonuses]


## 4. Smart Contract Features

### 4.1 Reward System

### 4.2 Progress Tracking
- On-chain verification of achievements
- Token distribution based on goals
- Streak maintenance
- Community challenges

## 5. Technical Architecture

### 5.1 Frontend Components




### 5.2 Backend Services
- AI Processing Service
- Nutrition Database
- User Progress Analytics
- Smart Contract Integration
- IPFS Storage for User Data

## 6. Data Storage

### 6.1 On-Chain Data
- User goals and targets
- Achievement records
- Token distribution history
- Verification checkpoints

### 6.2 Off-Chain Data (IPFS)
- Detailed food logs
- Progress photos
- Personal preferences
- Nutritional data

## 7. Integration Points

### 7.1 External Services
- OpenAI GPT-4 Vision
- TensorFlow.js
- Food nutrition databases
- Barcode databases

### 7.2 Blockchain
- Base network integration
- Token rewards system
- Achievement verification

## 8. MVP Development Phases

### Phase 1: Core Features
1. Wallet connection
2. Basic profile creation
3. AI food recognition
4. Basic calorie tracking
5. Simple reward system

### Phase 2: Enhanced Features
1. Barcode scanning
2. Detailed nutrition tracking
3. Progress visualization
4. Advanced rewards
5. Community features

### Phase 3: Advanced Features
1. AI recommendations
2. Pattern recognition
3. Integration with wearables
4. Social features
5. Marketplace integration