const express = require('express');
const router = express.Router();

const Briefing = require('../model/Briefing');
const Budget = require('../model/Budget');
const Feature = require('../model/Feature');
const BriefingFeature = require('../model/BriefingFeature');

const auth = require('../config/auth')();

/**
 * Get all briefings of a logged user
 */
router.get('/', auth.authenticate(), (req, res) => {
	var id_user = req.user.id;
	Briefing.findAll({
		where: { id_user }, include: [
			{
				model: Budget,
				required: true
			}, {
				model: BriefingFeature,
				include: [Feature]
			}
		]
	}).then(briefs => {

		//Promise that clean the output, this remove the join table (that's useless) and remove array for budget
		var cleanOutput = new Promise((resolve) => {
			var response = [];
			briefs.forEach(brief => {
				//create a array of features
				var features = [];
				brief.briefing_features.forEach(briefing_feature => {
					features.push(briefing_feature.feature);
				});
				//insert that array on output
				briefing = brief.toJSON();
				briefing.features = features;

				briefing.budget = briefing.budgets[0];

				//clean the useless data
				delete briefing.briefing_features;
				delete briefing.budgets;

				//push output on new array
				response.push(briefing);
			});
			resolve(response);
		});

		//execute the cleanup and send the result
		cleanOutput.then(response => {
			res.status(200).send(response);
		});
	}).catch(err => console.log(err));
});

/**
 * Get the briefing passed by id
 */
router.get('/briefing/:id_briefing', auth.authenticate(), (req, res) => {
	var id = req.params.id_briefing;
	Briefing.findByPk(id, {
		include: [
			{
				model: Budget,
				required: true
			}, {
				model: BriefingFeature,
				include: [Feature]
			}
		]
	}).then(brief => {

		//Promise that clean the output, this remove the join table (that's useless) and remove array for budget
		var cleanOutput = new Promise((resolve) => {
			
			var response;
			//create a array of features
			var features = [];
			brief.briefing_features.forEach(briefing_feature => {
				features.push(briefing_feature.feature);
			});
			//insert that array on output
			briefing = brief.toJSON();
			briefing.features = features;

			briefing.budget = briefing.budgets[0];

			//clean the useless data
			delete briefing.briefing_features;
			delete briefing.budgets;

			//push output on new array
			response = briefing;
			resolve(response);
		});

		//execute the cleanup and send the result
		cleanOutput.then(response => {
			res.status(200).send(response);
		});
	}).catch(err => console.log(err));
});

/**
 * Create a briefing
 */
router.post('/', auth.authenticate(), (req, res) => {
	//input validations
	req.assert('cl_name', "O nome do cliente é obrigatório.").notEmpty();
	req.assert('cl_phone', "O telefone do cliente é obrigatório.").notEmpty();
	req.assert('cl_email', "O email do cliente é obrigatório.").notEmpty().isEmail();
	req.assert('has_visual', "É obrigatório responder se há visual para o projeto.").notEmpty();
	req.assert('has_current', "É obrigatório responder se há projeto atual.").notEmpty();
	req.assert('has_logo', "É obrigatório informar se o projeto tem logo.").notEmpty();
	req.assert('description', "É obrigatório informar a descrição do projeto.").notEmpty();
	req.assert('proj_title', "É obrigatório informar o titulo do projeto.").notEmpty();
	req.assert('outline', "É obrigatório informar o esboço do projeto.").notEmpty();
	req.assert('objective', "É obrigatório informar o objetivo do projeto.").notEmpty();

	var errors = req.validationErrors();
	if (errors) {
		res.status(400).json(errors);
		return;
	}

	var brief = req.body;
	var budget = brief.budgets[0];

	var createFeatues = [];
	[...brief.features].forEach(ftr => {
		createFeatues.push(Feature.create(ftr));
	});

	//resolve promises for create a brief and all the features
	Promise.all([
		Briefing.create(brief),
		Promise.all(createFeatues)
	]).then(result => {
		//get the first result, shoud be a briefing
		var briefing = result[0];
		var response = req.body;
		response.id_briefing = briefing.id_briefing;
		//create a promise for insert the join table of briefing and feature
		var insertBriefingFeature = new Promise((resolve, reject) => {
			var createBriefingFeature = [];
			var i = 0;
			do {
				var featureCreated = result[1][i];
				var briefingFeature = {
					id_briefing: briefing.id_briefing,
					id_feature: featureCreated.id_feature
				}
				createBriefingFeature.push(BriefingFeature.create(briefingFeature));

				i++;
				if (i <= result.length) {
					resolve(createBriefingFeature);
				}
			} while (i < result.length);
		});
		//execute that promise
		insertBriefingFeature.then((createBriefingFeature) => {
			//set foreign key for briefing
			budget.id_briefing = briefing.id_briefing;
			//execute all the promise for creating join table and budget
			Promise.all(
				createBriefingFeature,
				Budget.create(budget)
			).then(rs => {
				//return result
				res.status(201).send(response);
			}).catch(err => console.log(err));
		}).catch(err => console.log(err));
	}).catch(err => console.log(err));
});

/**
 * Update a briefing
 */
router.put('/update', auth.authenticate(), (req, res) => {
	req.assert("id_briefing", "Você precisa passar o id do briefing").notEmpty();

	var errors = req.validationErrors();
	if (errors) {
		res.status(400).json(errors);
		return;
	}
	var brief = req.body;
	Briefing.update(brief, { where: { id_briefing: brief.id_briefing } })
		.then(briefing => {
			res.status(202).send(briefing);
			return;
		}).catch(err => console.log(err));
});

/**
 * Delete a briefing
 */
router.delete('/', auth.authenticate(), (req, res) => {
	req.assert('id_briefing', "Você precisa passar o id do briefing").notEmpty();

	var errors = req.validationErrors();
	if (errors) {
		res.status(400).send(errors);
	}

	var { id_briefing } = req.body;
	Briefing.destroy({ where: { id_briefing } })
		.then(n => {
			res.sendStatus(200);
		}).catch(err => console.log(err));
});

module.exports = (app) => {
	app.use('/api/briefings', router);
}