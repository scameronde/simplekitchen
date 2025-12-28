import { useState } from 'react';
import { NavigationBar } from './components/common/NavigationBar';
import { AddRecipePage } from './pages/AddRecipePage';
import { RecipeListPage } from './pages/RecipeListPage';
import { RecipeDetailPage } from './pages/RecipeDetailPage';

type View = 'add' | 'list' | 'detail';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('add');
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);

  const handleNavigate = (view: 'add' | 'list') => {
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
      {currentView === 'list' && <RecipeListPage onRecipeClick={handleRecipeClick} />}
      {currentView === 'detail' && selectedRecipeId !== null && (
        <RecipeDetailPage recipeId={selectedRecipeId} onBack={handleBackToList} />
      )}
    </div>
  );
}
