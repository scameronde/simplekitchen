import { useState } from 'react';
import { NavigationBar } from './components/common/NavigationBar';
import { AddRecipePage } from './pages/AddRecipePage';
import { RecipeListPage } from './pages/RecipeListPage';
import { RecipeDetailPage } from './pages/RecipeDetailPage';
import { RecipeGenerationPage } from './pages/RecipeGenerationPage';
import { RecipeImportPage } from './pages/RecipeImportPage';
import { ConversationPage } from './pages/ConversationPage';

type View = 'add' | 'list' | 'detail' | 'ai-generation' | 'import' | 'conversation';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('add');
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);

  const handleNavigate = (view: 'add' | 'list' | 'ai-generation' | 'import' | 'conversation') => {
    setCurrentView(view);
    setSelectedRecipeId(null);
  };

  const handleRecipeClick = (id: string) => {
    setSelectedRecipeId(id);
    setCurrentView('detail');
  };

  const handleBackToList = () => {
    setCurrentView('list');
    setSelectedRecipeId(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationBar currentView={currentView} onNavigate={handleNavigate} />

      {currentView === 'add' && <AddRecipePage />}
      {currentView === 'ai-generation' && <RecipeGenerationPage />}
      {currentView === 'import' && <RecipeImportPage />}
      {currentView === 'conversation' && <ConversationPage />}
      {currentView === 'list' && <RecipeListPage onRecipeClick={handleRecipeClick} />}
      {currentView === 'detail' && selectedRecipeId !== null && (
        <RecipeDetailPage recipeId={selectedRecipeId} onBack={handleBackToList} />
      )}
    </div>
  );
}
