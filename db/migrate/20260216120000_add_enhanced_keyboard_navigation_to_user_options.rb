# frozen_string_literal: true

class AddEnhancedKeyboardNavigationToUserOptions < ActiveRecord::Migration[7.2]
  def change
    add_column :user_options, :enable_enhanced_keyboard_navigation, :boolean
  end
end
