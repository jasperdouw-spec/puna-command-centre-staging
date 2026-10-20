-- Initial website catalogue only: provisional, requires Jose confirmation.
INSERT INTO products(id,name,description,price_cents,kind,available,source_status) VALUES
('eggplant','Roasted Eggplant','Caramelized onions, roasted peppers, eggplant, carrots and potatoes; red wine, herbs, raisins and hemp hearts.',800,'fresh',0,'initial'),
('chicken','Ají Chicken','Chicken, caramelized onions, potatoes, cream, walnuts, spices and sesame.',800,'fresh',0,'initial'),
('carne','Carne','Ground beef and pork, caramelized onions, roasted garlic, potatoes and sweet peas.',800,'fresh',0,'initial'),
('ham','Ham & Cheese','Smoked ham, mozzarella, mature cheddar, Dijon mayonnaise, potatoes and oregano.',800,'fresh',0,'initial'),
('strudel','Puna Strüdl','Apples, butter, spices, walnuts, raisins, quinoa and poppy seeds.',800,'fresh',0,'initial'),
('frozen-eggplant','Roasted Eggplant 4-pack','Raw frozen empanadas; product in development.',2500,'frozen',0,'initial'),
('frozen-chicken','Chicken 4-pack','Raw frozen empanadas; product in development.',2500,'frozen',0,'initial'),
('frozen-carne','Carne 4-pack','Raw frozen empanadas; product in development.',2500,'frozen',0,'initial')
ON DUPLICATE KEY UPDATE id=id;
